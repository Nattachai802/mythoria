// Thai spacing checker — Tier 1 (rule-based, fiction subset)
// อ้างอิง: หลักเกณฑ์การเว้นวรรค ราชบัณฑิตยสถาน (เลือกเฉพาะกฎที่ยิงโดนในงานนิยาย)
// ปรัชญา: "แนะนำ" ไม่ใช่ "แก้อัตโนมัติ" — นิยายเว้นวรรคเชิงศิลป์ได้ ผู้เขียนตัดสินใจเอง
//
// ตัด rule เอกสารทางการทิ้ง (จำกัด/มหาชน, ถนน/จังหวัด, หน่วยมาตรา, อักษรย่อ ก.ข.)
// — เพิ่มกลับเมื่อ data จากนิยายจริงบอกว่าต้องการ

export type SpacingType = "NONE" | "SMALL" | "UNKNOWN";

export interface Token {
    text: string;
    start: number; // index ใน string ต้นฉบับ (inclusive)
    end: number;   // exclusive
}

export interface SpacingError {
    position: number;          // index ของช่องว่าง หรือจุดที่ขาดช่องว่าง
    gapLength: number;         // ความยาวช่องว่างที่มีอยู่จริง (0 = ไม่มีช่องว่าง)
    leftToken: Token;
    rightToken: Token;
    actual: SpacingType;
    expected: SpacingType;
    ruleId: string;
    message: string;
}

const THAI_RANGE = /[฀-๿]/;
const FOREIGN_CHAR = /[A-Za-z぀-ヿ一-鿿]/;
const ANY_NUMBER = /^[0-9๐-๙]+([.,][0-9๐-๙]+)*$/;

// เครื่องหมายที่จัดการ (single-char) — multi-char specials แยกด้านล่าง
const NO_SPACE_AROUND = new Set(["-", "–", "—"]);
const SMALL_BOTH = new Set(["ๆ", "ฯลฯ", "=", ":", "ณ", "ธ"]);
const SMALL_AFTER = new Set([",", ";", ")", "”", "’", "ฯ"]);
const SMALL_BEFORE = new Set(["(", "“", "‘"]);

// token ที่ tokenizer ต้องตัดเป็นชิ้นเดี่ยว (เรียงตามความยาว — match ยาวก่อน)
const PUNCT = ["ฯลฯ", "ๆ", "ฯ", "=", ":", ",", ";", "(", ")", "“", "”", "‘", "’", "-", "–", "—"];

const endsWithThai = (s: string) => THAI_RANGE.test(s[s.length - 1]);
const startsWithThai = (s: string) => THAI_RANGE.test(s[0]);
const endsWithForeign = (s: string) => FOREIGN_CHAR.test(s[s.length - 1]);
const startsWithForeign = (s: string) => FOREIGN_CHAR.test(s[0]);
const hasThai = (s: string) => THAI_RANGE.test(s);
const isNumber = (s: string) => ANY_NUMBER.test(s);

/** แยก string เป็น tokens (รวม whitespace เป็น token แยก) */
export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];

        // whitespace run (รวม " " หลายช่อง — fiction subset เราสน NONE vs SMALL พอ)
        if (/\s/.test(ch)) {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j])) j++;
            tokens.push({ text: text.slice(i, j), start: i, end: j });
            i = j;
            continue;
        }

        // punctuation (match multi-char ก่อน เช่น "ฯลฯ")
        const punct = PUNCT.find((p) => text.startsWith(p, i));
        if (punct) {
            tokens.push({ text: punct, start: i, end: i + punct.length });
            i += punct.length;
            continue;
        }

        // word run: จนเจอ whitespace หรือ punct — แล้วแตกย่อยตามชนิดอักษร
        // (ไทย/อังกฤษ/เลข ที่ติดกันไม่มีช่องว่าง ต้องเป็นคนละ token เพื่อให้ classifier เห็นขอบ)
        let j = i;
        while (j < text.length && !/\s/.test(text[j]) && !PUNCT.some((p) => text.startsWith(p, j))) j++;
        let segStart = i;
        let cls = charClass(text[i]);
        for (let k = i + 1; k <= j; k++) {
            const c = k < j ? charClass(text[k]) : null;
            if (c !== cls) {
                tokens.push({ text: text.slice(segStart, k), start: segStart, end: k });
                segStart = k;
                cls = c!;
            }
        }
        i = j;
    }
    return tokens;
}

// ชนิดอักษรสำหรับตัด token ตามขอบสคริปต์ (เลขไทยถือเป็นเลข ไม่ใช่ไทย)
const DIGIT = /[0-9๐-๙.,]/;
function charClass(c: string): "thai" | "latin" | "digit" | "other" {
    if (DIGIT.test(c)) return "digit";
    if (THAI_RANGE.test(c)) return "thai";
    if (FOREIGN_CHAR.test(c)) return "latin";
    return "other";
}

const isSpace = (t: Token) => /^\s/.test(t.text);

function measureSpace(space: Token | null): SpacingType {
    if (!space) return "NONE";
    return "SMALL"; // fiction subset: ทุกช่องว่างที่มี ถือเป็น SMALL (ไม่แยก LARGE — นั่นเป็น Tier 2/LLM)
}

/** กฎหลัก — return กฎแรกที่ match, ไม่งั้น UNKNOWN (ปล่อยผ่าน) */
function classifyPair(left: Token, right: Token): { spacing: SpacingType; ruleId: string } {
    const L = left.text;
    const R = right.text;

    // ── NONE: ห้ามเว้นวรรค ─────────────────────────────
    if (NO_SPACE_AROUND.has(R) || NO_SPACE_AROUND.has(L)) return { spacing: "NONE", ruleId: "2.6" };
    if (L === "ฯ" && NO_SPACE_AROUND.has(R)) return { spacing: "NONE", ruleId: "2.5" };

    // ── SMALL: เว้นวรรคเล็ก ─────────────────────────────
    if (SMALL_AFTER.has(L)) return { spacing: "SMALL", ruleId: "1.2.15.3" };
    if (SMALL_BEFORE.has(R)) return { spacing: "SMALL", ruleId: "1.2.15.2" };
    if (SMALL_BOTH.has(L) || SMALL_BOTH.has(R)) return { spacing: "SMALL", ruleId: "1.2.15.1" };
    if ((endsWithThai(L) && startsWithForeign(R)) || (endsWithForeign(L) && startsWithThai(R)))
        return { spacing: "SMALL", ruleId: "1.2.13" };
    if ((hasThai(L) && isNumber(R)) || (isNumber(L) && hasThai(R)))
        return { spacing: "SMALL", ruleId: "1.2.10" };

    return { spacing: "UNKNOWN", ruleId: "" };
}

function buildMessage(expected: SpacingType, actual: SpacingType, l: string, r: string): string {
    if (expected === "SMALL" && actual === "NONE")
        return `ควรเว้นวรรคเล็กระหว่าง "${l}" กับ "${r}"`;
    if (expected === "NONE" && actual === "SMALL")
        return `ไม่ควรมีช่องว่างระหว่าง "${l}" กับ "${r}"`;
    return `ตรวจการเว้นวรรคระหว่าง "${l}" กับ "${r}"`;
}

/** ตรวจทั้งข้อความ → รายการจุดที่เว้นวรรคไม่ตรงกฎ */
export function checkSpacing(text: string): SpacingError[] {
    const tokens = tokenize(text);
    const errors: SpacingError[] = [];

    for (let i = 0; i < tokens.length; i++) {
        if (isSpace(tokens[i])) continue;
        const left = tokens[i];

        const next = tokens[i + 1];
        const space = next && isSpace(next) ? next : null;
        const right = space ? tokens[i + 2] : next;
        if (!right) break;

        const actual = measureSpace(space);
        const { spacing: expected, ruleId } = classifyPair(left, right);
        if (expected === "UNKNOWN" || expected === actual) continue;

        errors.push({
            position: space?.start ?? left.end,
            gapLength: space ? space.text.length : 0, // ความยาวช่องว่างปัจจุบัน (ใช้ตอนลบ)
            leftToken: left,
            rightToken: right,
            actual,
            expected,
            ruleId,
            message: buildMessage(expected, actual, left.text, right.text),
        });
    }
    return errors;
}

// ponytail: self-check แทน test framework — รันด้วย `npx tsx lib/thai-spacing.ts`
if (require.main === module) {
    const eq = (got: number, want: number, label: string) => {
        if (got !== want) throw new Error(`FAIL ${label}: got ${got}, want ${want}`);
    };
    eq(checkSpacing("วันๆ").length, 1, "ๆ ติดคำ → ต้อง flag");            // expected SMALL, actual NONE
    eq(checkSpacing("วัน ๆ").length, 0, "ๆ เว้นถูก → ไม่ flag");
    eq(checkSpacing("เลี้ยงสุนัข๓๐ตัว").length, 2, "ไทย↔เลขติดกัน → flag 2 จุด");
    eq(checkSpacing("ข้าวเหนือSmilaxในวงศ์X").length, 3, "ไทย↔อังกฤษติดกัน 3 ขอบ");
    eq(checkSpacing('เขาพูดว่า “สวัสดี”').length, 0, "อัญประกาศเว้นถูก");
    eq(checkSpacing("กรุงเทพฯ-เชียงใหม่").length, 0, "ฯ ก่อนยัติภังค์ → NONE");
    console.log("OK: thai-spacing self-check passed");
}
