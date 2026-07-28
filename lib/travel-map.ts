// ตารางเวลาเดินทางระหว่างสถานที่ — logic ล้วน ไม่แตะฐานข้อมูล เพื่อให้ตรวจสอบได้ด้วย node
// รันเช็ค: node --experimental-strip-types lib/travel-map.check.ts

export type TravelInfo = {
    travelTime: number | null
    travelTimeUnit: string | null
    travelMethod: string | null
}

export type ConnectionRow = TravelInfo & {
    sourceLocationId: string
    targetLocationId: string
    isBidirectional: boolean | null
}

export function travelKey(fromLocationId: string, toLocationId: string) {
    return `${fromLocationId}>${toLocationId}`
}

/**
 * แปลงรายการเส้นเชื่อมสถานที่เป็น Map สำหรับค้นในหน่วยความจำ
 *
 * เส้นหนึ่งใช้ได้ทิศทาง source→target เสมอ ส่วนทิศย้อนกลับใช้ได้เฉพาะเส้นที่ตั้ง
 * isBidirectional ไว้ (ตรงกับเงื่อนไข OR ของ query เดิม)
 *
 * ใส่ทิศตรงให้ครบก่อนแล้วค่อยเติมทิศย้อนกลับ เพื่อให้เส้นที่ระบุทิศตรงไว้ชนะเสมอ
 * ของเดิมใช้ findFirst โดยไม่มี ORDER BY ผลจึงขึ้นกับลำดับแถวที่ฐานข้อมูลคืนมา
 */
export function buildTravelMap(rows: ConnectionRow[]): Map<string, TravelInfo> {
    const map = new Map<string, TravelInfo>()
    const info = (c: ConnectionRow): TravelInfo => ({
        travelTime: c.travelTime,
        travelTimeUnit: c.travelTimeUnit,
        travelMethod: c.travelMethod,
    })

    for (const c of rows) {
        const k = travelKey(c.sourceLocationId, c.targetLocationId)
        if (!map.has(k)) map.set(k, info(c))
    }
    for (const c of rows) {
        if (!c.isBidirectional) continue
        const k = travelKey(c.targetLocationId, c.sourceLocationId)
        if (!map.has(k)) map.set(k, info(c))
    }

    return map
}
