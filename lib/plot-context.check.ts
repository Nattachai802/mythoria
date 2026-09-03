/** ตรวจ renderer ของ plot-context — รันด้วย `npm run check` */
import assert from "node:assert";
import { renderSceneDigest, renderSceneDigestDoc, renderChapterDigest, PLOT_CONTEXT_CONSUMERS, type DigestScene } from "./plot-context.ts";

const full: DigestScene = {
    id: "s1", title: "ฉากเปิด", sceneType: "setup", sceneTone: "calm", pacing: 3,
    goal: "แนะนำโลก", conflict: "ยังไม่มี", outcome: "ongoing", recap: "ตัวเอกตื่นมาในเมืองแปลกหน้า",
    beats: [{ id: "i1", title: "การ์ดหนึ่ง", sceneType: "setup", pacing: 2, content: "x".repeat(500) }],
};

const one = renderSceneDigest(full);
assert(one.includes("id: s1") && one.includes("id: i1"), "digest ต้องมี id ทั้งฉากและการ์ดย่อย (AI ตอบกลับด้วย id นี้)");
assert(one.includes("จังหวะที่ตั้งไว้: 3"), "ค่า pacing ของฉากต้องอยู่ใน digest");
assert(one.includes("สรุปฉาก: ตัวเอกตื่นมา"), "recap ต้องแทรกเข้า digest ได้");
assert(!one.includes("x".repeat(300)), "เนื้อการ์ดต้องถูกตัดสั้น ไม่งั้น digest ไม่ประหยัดกว่า full");

// ฟิลด์ว่างต้องหายไปทั้งบรรทัด ไม่ใช่โผล่เป็น "ประเภท: null" ให้ AI อ่านเป็นข้อมูล
const bare = renderSceneDigest({ id: "s2", title: "ฉากเปล่า", pacing: null, beats: [] });
assert(!bare.includes("null") && !bare.includes("undefined"), "ฟิลด์ว่างต้องไม่ render");
assert(!bare.includes("การ์ดย่อยในฉาก"), "ฉากที่ไม่มีการ์ดย่อยต้องไม่มีหัวข้อการ์ดย่อยลอย ๆ");
assert(bare.includes("ฉากเปล่า"), "ชื่อฉากต้องยังอยู่");

const chapter = renderChapterDigest("บทที่ 1", [full, { id: "s3", title: "ฉากท้าย", beats: [] }]);
assert(chapter.includes("จำนวนฉาก: 2"), "หัวเอกสารต้องบอกจำนวนฉาก");
assert(chapter.indexOf("id: s1") < chapter.indexOf("id: s3"), "ลำดับฉากต้องคงตามที่ส่งเข้ามา (AI ใช้ลำดับตัดสินจังหวะ)");

// hideUserPacing: ฟีเจอร์ที่ให้ AI ตัดสิน pacing ใหม่ ต้องไม่เห็นค่าที่นักเขียนตั้งไว้ (กัน anchor)
const hidden = renderSceneDigest(full, { hideUserPacing: true });
assert(!hidden.includes("จังหวะที่ตั้งไว้"), "ต้องไม่มีค่า pacing ของนักเขียนทั้งระดับฉากและการ์ดย่อย");
assert(hidden.includes("id: s1") && hidden.includes("id: i1") && hidden.includes("เป้าหมาย"), "ฟิลด์อื่นต้องยังอยู่ครบ");
assert(PLOT_CONTEXT_CONSUMERS["pacing-ai-suggest"].hideUserPacing === true, "pacing-ai-suggest ต้องเปิด hideUserPacing");

// รายฉาก: ต้องมีแค่ฉากนั้น แต่ยังบอกตำแหน่งในบท (AI ใช้ตัดสินว่าควรเร่งหรือผ่อน)
const doc = renderSceneDigestDoc("บทที่ 1", full, { index: 3, total: 7 });
assert(doc.includes("ฉากที่ 3 จาก 7"), "ต้องบอกตำแหน่งฉากในบท");
assert(doc.includes("id: s1") && doc.includes("id: i1"), "ต้องมีฉากนั้นกับการ์ดย่อยของมัน");
assert(!doc.includes("id: s3"), "ต้องไม่มีฉากอื่นหลุดเข้ามา");

// registry: key ต้องตรงกับ AI_FEATURES ไม่งั้นเรียกประตูแล้วพังตอน runtime
const { AI_FEATURES } = await import("./ai-features.ts");
for (const key of Object.keys(PLOT_CONTEXT_CONSUMERS)) {
    assert(key in AI_FEATURES, `consumer "${key}" ไม่มีใน AI_FEATURES`);
}

console.log("✅ plot-context ผ่านทั้งหมด");
