/**
 * สร้าง/รีเซ็ตบัญชีเดโมสำหรับโหมดผู้เยี่ยมชม
 *
 *   node --experimental-strip-types scripts/seed-demo.ts
 *
 * รันซ้ำได้: ลบ user เดโมทิ้งก่อน (FK cascade เก็บกวาดนิยายให้เอง) แล้วสร้างใหม่
 * ใช้ SQL ตรงแทน drizzle เพราะ script อื่นในโฟลเดอร์นี้ก็ทำแบบเดียวกัน และไม่ต้องลาก
 * lib/auth (ที่ import next/headers) เข้ามาใน node เปล่าๆ
 *
 * ponytail: ข้อมูลชุดเล็กแบบ hardcode — ถ้าอยากได้เดโมที่ลึกกว่านี้ ค่อยเปลี่ยนไป
 * clone นิยายจริงของบัญชีตัวเองแทน
 */
import { config } from "dotenv";
import { Client } from "pg";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

config({ path: ".env" });

const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

if (!EMAIL || !PASSWORD) {
    console.error("ต้องตั้ง DEMO_EMAIL และ DEMO_PASSWORD ใน .env ก่อน");
    process.exit(1);
}

const connectionString = process.env.DB_TARGET === "local"
    ? process.env.LOCAL_DATABASE_URL
    : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

/** เอกสาร Tiptap ขั้นต่ำจากย่อหน้าล้วน */
const doc = (...paragraphs: string[]) => ({
    type: "doc",
    content: paragraphs.map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
    })),
});

const words = (...paragraphs: string[]) =>
    paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

const client = new Client({ connectionString });
await client.connect();

try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM "user" WHERE email = $1`, [EMAIL]);

    const userId = randomUUID();
    await client.query(
        `INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, $2, $3, true)`,
        [userId, "ผู้เยี่ยมชม", EMAIL],
    );
    await client.query(
        `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
        [randomUUID(), userId, await hashPassword(PASSWORD)],
    );

    const novelId = randomUUID();
    await client.query(
        `INSERT INTO novels (id, title, description, user_id, genre, status, word_count, target_word_count)
         VALUES ($1, $2, $3, $4, 'fantasy', 'in_progress', 0, 120000)`,
        [
            novelId,
            "ลมหายใจสุดท้ายของหอคอยเหนือ",
            "นิยายตัวอย่างสำหรับโหมดผู้เยี่ยมชม — ข้อมูลทั้งหมดถูกใส่ไว้ให้ดูโครงสร้างของระบบ",
            userId,
        ],
    );

    const chapters: Array<[string, string, string[]]> = [
        [
            "บทที่ 1: เสียงระฆังที่ไม่มีใครสั่น",
            "อาริยาได้ยินระฆังหอคอยเหนือดังขึ้นกลางดึก ทั้งที่หอคอยถูกปิดตายมาสิบสองปี",
            [
                "ระฆังดังตอนตีสาม เสียงเดียว ยาว และผิดที่ผิดทางจนอาริยาลุกขึ้นนั่งทั้งที่ยังไม่ทันตื่นเต็มตา",
                "หอคอยเหนือถูกปิดตายมาตั้งแต่ปีที่พ่อของเธอหายไป ไม่มีบันได ไม่มีประตู มีแต่หินที่คนทั้งเมืองตกลงกันว่าจะไม่พูดถึง",
            ],
        ],
        [
            "บทที่ 2: คนที่จำชื่อตัวเองไม่ได้",
            "ที่เชิงหอคอย อาริยาพบชายคนหนึ่งที่รู้จักเธอดี แต่จำชื่อของตัวเองไม่ได้",
            [
                "ชายคนนั้นนั่งอยู่ตรงเชิงหอคอย เสื้อคลุมเปียกน้ำค้าง เขาเรียกชื่อเธอถูกตั้งแต่ครั้งแรกที่เห็นหน้า",
                "\"ผมรู้จักคุณ\" เขาพูด \"แต่ถ้าคุณถามว่าผมชื่ออะไร ผมจะตอบไม่ได้เลยสักคำ\"",
            ],
        ],
    ];

    for (const [i, [title, summary, paragraphs]] of chapters.entries()) {
        await client.query(
            `INSERT INTO chapters (id, title, summary, novel_id, order_index, content, plain_text, word_count, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')`,
            [randomUUID(), title, summary, novelId, i, doc(...paragraphs), paragraphs.join("\n\n"), words(...paragraphs)],
        );
    }

    await client.query(
        `UPDATE novels SET word_count = (SELECT coalesce(sum(word_count), 0) FROM chapters WHERE novel_id = $1) WHERE id = $1`,
        [novelId],
    );

    const characters: Array<[string, string, string, string]> = [
        ["อาริยา", "protagonist", "ลูกสาวช่างตีระฆังที่หายตัวไปพร้อมหอคอย", "ดื้อ ตรงไปตรงมา ไม่ยอมรับคำอธิบายที่ฟังแล้วไม่เข้าท่า"],
        ["ชายไร้ชื่อ", "supporting", "ชายที่โผล่มาที่เชิงหอคอยในคืนเดียวกับที่ระฆังดัง", "สุภาพจนน่าอึดอัด พูดถึงอดีตของคนอื่นได้ละเอียดกว่าของตัวเอง"],
        ["ผู้ว่าเมืองเก่า", "antagonist", "คนที่สั่งปิดหอคอยเมื่อสิบสองปีก่อน", "ใจเย็น คำนวณ เชื่อว่าความสงบสำคัญกว่าความจริง"],
    ];

    const charIds: string[] = [];
    for (const [name, role, description, personality] of characters) {
        const id = randomUUID();
        charIds.push(id);
        await client.query(
            `INSERT INTO characters (id, name, role, novel_id, description, personality) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, name, role, novelId, description, personality],
        );
    }

    await client.query(
        `INSERT INTO character_relationships (id, novel_id, source_character_id, target_character_id, type, description, opinion_level, sentiment)
         VALUES ($1, $2, $3, $4, 'ally', 'ร่วมทางกันเพราะต่างต้องการคำตอบจากหอคอยเดียวกัน', 60, 'mixed')`,
        [randomUUID(), novelId, charIds[0], charIds[1]],
    );
    await client.query(
        `INSERT INTO character_relationships (id, novel_id, source_character_id, target_character_id, type, description, opinion_level, sentiment)
         VALUES ($1, $2, $3, $4, 'enemy', 'อาริยาเชื่อว่าเขารู้ว่าพ่อของเธอหายไปไหน', 15, 'negative')`,
        [randomUUID(), novelId, charIds[0], charIds[2]],
    );

    const lore: Array<[string, string, string, number]> = [
        ["คำสั่งปิดหอคอยเหนือ", "history", "สิบสองปีก่อน เมืองลงมติปิดหอคอยถาวรหลังจากช่างตีระฆังหกคนหายตัวไปในคืนเดียว", 8],
        ["ตำนานระฆังที่สั่นเอง", "legend", "ว่ากันว่าระฆังหอคอยเหนือจะดังเองเมื่อมีคนที่ 'ยังไม่ตายและยังไม่มีชีวิต' เดินผ่านเชิงหอคอย", 9],
    ];
    for (const [i, [title, type, content, importance]] of lore.entries()) {
        await client.query(
            `INSERT INTO lore_entries (id, title, content, type, novel_id, order_index, importance) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), title, content, type, novelId, i, importance],
        );
    }

    // Context Fabric: กราฟ/คลังเรื่องอ่านจากตาราง references ล้วน ไม่ได้อ่าน junction เดิม
    // seed ที่ insert ตรงจึงต้องเขียน edge เองด้วย ไม่งั้นทั้งสองมุมมองว่างเปล่าทั้งที่มีข้อมูล
    const [loreIds] = [(await client.query(
        `SELECT id FROM lore_entries WHERE novel_id = $1 ORDER BY order_index`, [novelId],
    )).rows.map((r: { id: string }) => r.id)];

    const edges: Array<[string, string, string, string, string]> = [
        ["character", charIds[0], "character", charIds[1], "related_to"],
        ["character", charIds[0], "character", charIds[2], "related_to"],
        ["character", charIds[0], "lore", loreIds[1], "linked_to"],
        ["character", charIds[2], "lore", loreIds[0], "linked_to"],
        ["lore", loreIds[0], "lore", loreIds[1], "linked_to"],
    ];
    for (const [fromType, fromId, toType, toId, relation] of edges) {
        await client.query(
            `INSERT INTO "references" (id, novel_id, from_type, from_id, to_type, to_id, relation, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'user')`,
            [randomUUID(), novelId, fromType, fromId, toType, toId, relation],
        );
    }

    const noteText = [
        "ปมที่ต้องเฉลยก่อนจบภาคแรก: ชายไร้ชื่อคือใคร และทำไมเขาถึงจำเรื่องของคนอื่นได้หมดยกเว้นตัวเอง",
        "ยังไม่ตัดสินใจว่าพ่อของอาริยาควรยังมีชีวิตอยู่หรือไม่ ทั้งสองทางเปลี่ยนโทนตอนจบคนละแบบ",
    ];
    await client.query(
        `INSERT INTO notes (id, title, content, novel_id, type, status) VALUES ($1, $2, $3, $4, 'plot_note', 'writing')`,
        [randomUUID(), "ปมค้างที่ยังไม่ได้ตอบ", doc(...noteText), novelId],
    );

    await client.query("COMMIT");
    console.log(`สร้างบัญชีเดโมเรียบร้อย: ${EMAIL} (novel ${novelId})`);
} catch (error) {
    await client.query("ROLLBACK");
    throw error;
} finally {
    await client.end();
}
