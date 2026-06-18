// Run: npx tsx lib/mentions.test.ts
import { parseMentions } from "./mentions";

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
