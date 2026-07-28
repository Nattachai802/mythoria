// เช็คตัวเอง — รัน: node --experimental-strip-types lib/travel-map.check.ts
import assert from "node:assert/strict"
import { buildTravelMap, travelKey, type ConnectionRow } from "./travel-map.ts"

const conn = (
    sourceLocationId: string,
    targetLocationId: string,
    isBidirectional: boolean | null,
    travelTime: number | null,
): ConnectionRow => ({
    sourceLocationId,
    targetLocationId,
    isBidirectional,
    travelTime,
    travelTimeUnit: "hours",
    travelMethod: "walk",
})

// เส้นไปกลับ ใช้ได้ทั้งสองทิศ
{
    const m = buildTravelMap([conn("a", "b", true, 5)])
    assert.equal(m.get(travelKey("a", "b"))?.travelTime, 5)
    assert.equal(m.get(travelKey("b", "a"))?.travelTime, 5)
}

// เส้นทางเดียว ใช้ได้เฉพาะทิศตรง — ทิศย้อนกลับต้องไม่มี
{
    const m = buildTravelMap([conn("a", "b", false, 5)])
    assert.equal(m.get(travelKey("a", "b"))?.travelTime, 5)
    assert.equal(m.get(travelKey("b", "a")), undefined)
}

// isBidirectional เป็น null (คอลัมน์ยอมให้ null ได้) ถือว่าไม่ไปกลับ
{
    const m = buildTravelMap([conn("a", "b", null, 5)])
    assert.equal(m.get(travelKey("b", "a")), undefined)
}

// เส้นที่ระบุทิศตรงไว้ ต้องชนะเส้นไปกลับของอีกคู่เสมอ ไม่ว่าจะเรียงลำดับมายังไง
{
    const direct = conn("a", "b", false, 1)
    const reverse = conn("b", "a", true, 99)
    assert.equal(buildTravelMap([direct, reverse]).get(travelKey("a", "b"))?.travelTime, 1)
    assert.equal(buildTravelMap([reverse, direct]).get(travelKey("a", "b"))?.travelTime, 1)
}

// ไม่มีเส้นเชื่อม = ไม่เจอ
assert.equal(buildTravelMap([]).get(travelKey("a", "b")), undefined)

console.log("travel-map ผ่านทั้งหมด")
