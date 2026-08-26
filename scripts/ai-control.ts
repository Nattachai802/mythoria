/**
 * AI Control CLI — คุม flag/quota ของฟีเจอร์ AI ทั้งหมดจาก terminal
 * -----------------------------------------------------------------
 * registry เดียวกับ gateway (lib/ai-features.ts) · แก้ตาราง ai_features ตรงๆ
 * Next.js app อ่าน override ใหม่ภายใน 15 วิ (cache TTL) — ไม่ต้องรีสตาร์ท
 *
 *   npm run ai list                 ดูทุกฟีเจอร์ + สถานะ + quota + ใช้ไปวันนี้
 *   npm run ai on <key>             เปิดฟีเจอร์ (เช่น npm run ai on librarian)
 *   npm run ai off <key>            ปิดฟีเจอร์
 *   npm run ai quota <key> <N>      ตั้งโควตา N ครั้ง/วัน/ผู้ใช้ (0 = ไม่จำกัด)
 *   npm run ai reset <key>          ลบ override → กลับไปค่า default จาก registry
 *   npm run ai log [N]              ดู AI runs ล่าสุด N แถว (default 20)
 */
import { config } from "dotenv";
import { Client } from "pg";
import { AI_FEATURES } from "../lib/ai-features.ts";

config({ path: ".env" });

const connectionString = process.env.DB_TARGET === "local"
    ? process.env.LOCAL_DATABASE_URL
    : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

if (!connectionString) {
    console.error("ไม่พบ connection string ใน .env (NEON_DATABASE_URL หรือ DATABASE_URL)");
    process.exit(1);
}

const [cmd, key, value, ...rest] = process.argv.slice(2);

function fail(msg: string): never {
    console.error(`✗ ${msg}`);
    process.exit(1);
}

function requireKey(): string {
    if (!key || !(key in AI_FEATURES)) {
        console.error(`feature key ไม่ถูกต้อง${key ? `: "${key}"` : " (ไม่ได้ระบุ)"}\n`);
        console.error("keys ที่มี:", Object.keys(AI_FEATURES).join(", "));
        process.exit(1);
    }
    return key;
}

async function main() {
    const client = new Client({ connectionString });
    await client.connect();
    try {
        switch (cmd) {
            case "list": {
                const overrides = new Map<string, { enabled: boolean; daily_limit_per_user: number | null }>();
                const { rows } = await client.query(
                    "SELECT key, enabled, daily_limit_per_user FROM ai_features",
                );
                for (const r of rows) overrides.set(r.key, r);

                const usedToday = new Map<string, number>();
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const { rows: usage } = await client.query(
                    `SELECT feature, count(*)::int AS n FROM ai_usage_log
                     WHERE created_at >= $1 AND status <> 'blocked' GROUP BY feature`,
                    [startOfDay],
                );
                for (const r of usage) usedToday.set(r.feature, r.n);

                console.log("\n  FEATURE KEY                     STATUS  QUOTA/USER/DAY   USED TODAY  PROVIDERS");
                console.log("  " + "─".repeat(108));
                for (const def of Object.values(AI_FEATURES)) {
                    const o = overrides.get(def.key);
                    const enabled = o ? o.enabled : true;
                    const limit = o ? o.daily_limit_per_user : def.defaultDailyLimit;
                    const used = usedToday.get(def.key) ?? 0;
                    const providers = def.chain.length
                        ? def.chain.map((s) => `${s.provider}/${s.model}`).join(" → ")
                        : (def.pythonModels ?? []).join(", ") || "python microservice";
                    console.log(
                        `  ${def.key.padEnd(31)} ${enabled ? "🟢 ON " : "🔴 OFF"}  ` +
                        `${(limit === null ? "unlimited" : String(limit)).padStart(15)}  ` +
                        `${String(used).padStart(10)}  ${providers}`,
                    );
                }
                console.log();
                break;
            }

            case "on":
            case "off": {
                const k = requireKey();
                const enabled = cmd === "on";
                // สร้างแถวใหม่ต้องพก default quota จาก registry มาด้วย ไม่งั้น NULL = unlimited ผิดค่า
                // ON CONFLICT อัปเดตเฉพาะ enabled — quota ที่ตั้งไว้ไม่ถูกทับ
                await client.query(
                    `INSERT INTO ai_features (key, enabled, daily_limit_per_user)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
                    [k, enabled, AI_FEATURES[k].defaultDailyLimit],
                );
                console.log(`${enabled ? "🟢 เปิด" : "🔴 ปิด"} "${AI_FEATURES[k].label}" (${k}) แล้ว — app อัปเดตภายใน ~15 วิ`);
                break;
            }

            case "quota": {
                const k = requireKey();
                if (value === undefined) fail("ระบุค่า quota เช่น: npm run ai quota librarian 100  (0 = ไม่จำกัด)");
                const n = Number(value);
                if (!Number.isInteger(n) || n < 0) fail("quota ต้องเป็นจำนวนเต็ม ≥ 0 (0 = ไม่จำกัด)");
                void rest;
                const limit = n === 0 ? null : n;
                await client.query(
                    `INSERT INTO ai_features (key, daily_limit_per_user) VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET daily_limit_per_user = $2, updated_at = now()`,
                    [k, limit],
                );
                console.log(`quota "${AI_FEATURES[k].label}" = ${limit === null ? "ไม่จำกัด" : `${limit} ครั้ง/วัน/ผู้ใช้`}`);
                break;
            }

            case "reset": {
                const k = requireKey();
                const def = AI_FEATURES[k];
                await client.query("DELETE FROM ai_features WHERE key = $1", [k]);
                console.log(`reset "${def.label}" → default (เปิด, quota ${def.defaultDailyLimit ?? "ไม่จำกัด"})`);
                break;
            }

            case "log": {
                const n = Math.min(Number(value) || 20, 200);
                const { rows } = await client.query(
                    `SELECT created_at, feature, provider, model, status,
                            prompt_tokens, completion_tokens, latency_ms, error_detail
                     FROM ai_usage_log ORDER BY created_at DESC LIMIT $1`,
                    [n],
                );
                if (rows.length === 0) {
                    console.log("ยังไม่มี log — log จะเกิดหลังใช้ฟีเจอร์ AI ใดๆ");
                    break;
                }
                console.log(`\n  AI runs ล่าสุด ${rows.length} แถว\n  ` + "─".repeat(104));
                for (const r of rows) {
                    const time = new Date(r.created_at).toLocaleString("th-TH", { hour12: false });
                    const tokens = r.prompt_tokens + r.completion_tokens;
                    console.log(
                        `  ${time}  ${r.status === "success" ? "✓" : r.status === "error" ? "✗" : "⛔"} ` +
                        `${r.feature.padEnd(26)} ${r.provider}/${r.model}` +
                        (tokens > 0 ? `  (${tokens} tok)` : "") +
                        (r.latency_ms != null ? `  ${(r.latency_ms / 1000).toFixed(1)}s` : "") +
                        (r.error_detail ? `\n      ↳ ${r.error_detail.slice(0, 120)}` : ""),
                    );
                }
                console.log();
                break;
            }

            default:
                console.log(
                    [
                        "",
                        "  AI Control — คำสั่งที่ใช้ได้:",
                        "",
                        "    npm run ai list                  ดูทุกฟีเจอร์ + สถานะ + quota + ใช้วันนี้",
                        "    npm run ai on <key>              เปิดฟีเจอร์",
                        "    npm run ai off <key>             ปิดฟีเจอร์",
                        "    npm run ai quota <key> <N>       โควตา N ครั้ง/วัน/ผู้ใช้ (0 = ไม่จำกัด)",
                        "    npm run ai reset <key>           กลับไปค่า default จาก registry",
                        "    npm run ai log [N]               ดู runs ล่าสุด",
                        "",
                        `    keys: ${Object.keys(AI_FEATURES).join(", ")}`,
                        "",
                    ].join("\n"),
                );
        }
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
});
