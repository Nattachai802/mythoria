import assert from "node:assert/strict";
import { verifyFacetExtract, FACETS } from "./facet-extract.ts";

assert.equal(FACETS.length, 30);
assert.equal(new Set(FACETS.map((f) => f.key)).size, 30);

const src = "เขาไม่ไว้ใจใครเลย นับเงินทอนทุกครั้ง แต่กับเด็กข้างบ้านกลับใจอ่อนมาก";
const v = verifyFacetExtract({
    facets: [
        { key: "A1", direction: "low", strength: 87, scene: "นับเงินทอน", quote: "ไม่ไว้ใจใครเลย" },   // quote จริง
        { key: "A6", direction: "x", strength: "abc", scene: "", quote: "หวงของมาก" },               // quote แต่ง → ล้าง, ค่าแปลก → default
        { key: "A1", direction: "high", strength: 50, scene: "", quote: "" },                         // ซ้ำ → ตัด
        { key: "N2", direction: "high", strength: 50, scene: "", quote: "" },                         // ซ้ำของเดิม (ชื่อ "โกรธง่าย") → ตัด
        { key: "Z9", direction: "high", strength: 50, scene: "", quote: "" },                         // นอกรายการ → ตัด
    ],
    contradictions: [{ text: "ระแวงทุกคน แต่ใจอ่อนกับเด็ก", quoteA: "ไม่ไว้ใจใครเลย", quoteB: "ใจอ่อนมาก" }, { text: "" }],
}, src, ["โกรธง่าย"]);

assert.equal(v.facets.length, 2);
assert.deepEqual([v.facets[0].name, v.facets[0].direction, v.facets[0].strength, v.facets[0].quote], ["ไว้ใจคน", "low", 90, "ไม่ไว้ใจใครเลย"]);
assert.deepEqual([v.facets[1].direction, v.facets[1].strength, v.facets[1].quote], ["high", 60, ""]);
assert.equal(v.contradictions.length, 1);
assert.deepEqual([v.contradictions[0].quoteA, v.contradictions[0].quoteB], ["ไม่ไว้ใจใครเลย", "ใจอ่อนมาก"]);
// ขยะ → ว่าง ไม่พัง
assert.deepEqual(verifyFacetExtract(null, src), { facets: [], contradictions: [] });
console.log("facet-extract.check ok");
