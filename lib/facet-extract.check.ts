import assert from "node:assert/strict";
import { verifyFacetExtract } from "./facet-extract.ts";

const src = "เขาไม่ไว้ใจใครเลย นับเงินทอนทุกครั้ง แต่กับเด็กข้างบ้านกลับใจอ่อนมาก";
const v = verifyFacetExtract({
    facets: [
        { name: "ไม่ไว้ใจใคร", direction: "high", strength: 87, scene: "นับเงินทอน", quote: "ไม่ไว้ใจใครเลย" }, // quote จริง
        { name: "ขี้หวง", direction: "x", strength: "abc", scene: "", quote: "หวงของมาก" },                   // quote แต่ง → ล้าง, ค่าแปลก → default
        { name: "ไม่ไว้ใจใคร ", direction: "high", strength: 50, scene: "", quote: "" },                      // ซ้ำ → ตัด
        { name: "ใจร้อน", direction: "high", strength: 50, scene: "", quote: "" },                            // ซ้ำของเดิม → ตัด
        { name: "", direction: "high", strength: 50, scene: "", quote: "" },                                  // ไม่มีชื่อ → ตัด
    ],
    contradictions: [{ text: "ระแวงทุกคน แต่ใจอ่อนกับเด็ก", quoteA: "ไม่ไว้ใจใครเลย", quoteB: "ใจอ่อนมาก" }, { text: "" }],
}, src, ["ใจร้อน"]);

assert.equal(v.facets.length, 2);
assert.deepEqual([v.facets[0].strength, v.facets[0].quote], [90, "ไม่ไว้ใจใครเลย"]);
assert.deepEqual([v.facets[1].direction, v.facets[1].strength, v.facets[1].quote], ["high", 60, ""]);
assert.equal(v.contradictions.length, 1);
assert.deepEqual([v.contradictions[0].quoteA, v.contradictions[0].quoteB], ["ไม่ไว้ใจใครเลย", "ใจอ่อนมาก"]);
// ขยะ → ว่าง ไม่พัง
assert.deepEqual(verifyFacetExtract(null, src), { facets: [], contradictions: [] });
console.log("facet-extract.check ok");
