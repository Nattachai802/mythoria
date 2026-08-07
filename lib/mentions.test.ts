// Run: npx tsx lib/mentions.test.ts
import { parseMentions, mentionRangeAtCaret } from "./mentions";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const span = (id: string, type: string) =>
    `<span class="mention" data-denotation-char="@" data-id="${id}" data-value="X" data-type="${type}">@X</span>`;

// 1. basic extract
assert(
    JSON.stringify(parseMentions(`<p>hi ${span("c1", "character")} there</p>`)) ===
        JSON.stringify([{ type: "character", id: "c1" }]),
    "extracts one mention",
);

// 2. multiple + mixed types
assert(
    parseMentions(`${span("c1", "character")} ${span("l1", "location")}`).length === 2,
    "extracts multiple types",
);

// 3. dedupe same edge
assert(
    parseMentions(`${span("c1", "character")}${span("c1", "character")}`).length === 1,
    "dedupes identical mention",
);

// 4. ignores non-mention spans + plain text
assert(
    parseMentions(`<span class="other" data-id="x" data-type="character">no</span>plain`).length === 0,
    "ignores non-mention span",
);

// 5. skips malformed (missing type)
assert(
    parseMentions(`<span class="mention" data-id="c1">@x</span>`).length === 0,
    "skips mention without data-type",
);

// 6. empty
assert(parseMentions("").length === 0, "empty html → []");

console.log("\nALL PASS ✓");

// --- mentionRangeAtCaret ---
const NAMES = ["สมชาย", "สมชายใหญ่", "Ann"];
const range = (t: string, c: number, d: "back" | "forward") => JSON.stringify(mentionRangeAtCaret(t, c, NAMES, d));

// 7. backspace ท้ายแท็ก (มีช่องว่างที่ insertQm เติม) → กินทั้งแท็ก+ช่องว่าง
assert(range("hi @Ann ", 8, "back") === "[3,8]", "back: กิน @Ann + ช่องว่าง");

// 8. ไม่มีช่องว่างก็ได้
assert(range("hi @Ann", 7, "back") === "[3,7]", "back: กิน @Ann ไม่มีช่องว่าง");

// 9. caret กลางแท็ก = ไม่ใช่ขอบ → null (ปล่อยให้ลบทีละตัวตามปกติ)
assert(range("hi @Ann", 5, "back") === "null", "back: caret กลางแท็ก → null");

// 10. ชื่อยาวต้องชนะชื่อสั้นที่เป็น prefix
assert(range("@สมชายใหญ่", 10, "back") === "[0,10]", "back: ชื่อยาวชนะ prefix");

// 11. delete มองไปข้างหน้า
assert(range("hi @Ann x", 3, "forward") === "[3,8]", "forward: กิน @Ann + ช่องว่าง");

// 12. ไม่ใช่ mention → null
assert(range("hi there", 8, "back") === "null", "back: ข้อความธรรมดา → null");

// 13. ไม่มีรายชื่อ → null (กันสร้าง regex ว่าง)
assert(mentionRangeAtCaret("@Ann", 4, [], "back") === null, "ไม่มีรายชื่อ → null");

console.log("\nALL PASS ✓");
