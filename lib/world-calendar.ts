/**
 * ปฏิทินของโลกในนิยาย (เส้นเวลาเฟส 2) — pure ไม่แตะ DB ไม่แตะ React
 * ------------------------------------------------------------------
 * แผนเต็ม: docs/treatment-timeline-plan.md หัวข้อ 5
 *
 * ทุกเวลาบนแกนเก็บเป็น "เลขวันสัมบูรณ์" (day) ตัวเดียว นับจากวันที่ 1 เดือนแรกของปีสัมบูรณ์ 1 = day 0
 * ปีสัมบูรณ์ติดลบได้ (ก่อนปี 1) · ยุคแต่ละยุคบอกแค่ว่าปีที่ 1 ของยุคตรงกับปีสัมบูรณ์ไหน (eras.start_year)
 *
 * ponytail: ปีทุกปียาวเท่ากัน ไม่มีปีอธิกสุรทิน — นิยายแฟนตาซีส่วนใหญ่ไม่ต้องการ
 * ถ้าวันหนึ่งต้องมี ต้องเปลี่ยน dayOf/fromDay ทั้งคู่ (ข้อมูลที่เก็บเป็น day ไม่ต้องแปลง)
 */

export interface CalendarMonth { name: string; days: number }

export interface WorldCalendar {
    months: CalendarMonth[];
    /**
     * "Day 1" ของฉาก (timeline_events.story_date = 1) ตรงกับวันไหนในโลก
     * null = ยังไม่ผูก — ฉากที่มีแค่ story_date จะยังไม่มีเวลาจริง (ใช้ลำดับแบบเฟส 1)
     */
    anchor: { year: number; month: number; day: number } | null;
}

/** ความละเอียดของเวลา — ไม่ให้แสดง "วันที่ 1 เดือน 1" กับของที่รู้แค่ปี */
export const TIME_PRECISIONS = ["year", "month", "day"] as const;
export type TimePrecision = (typeof TIME_PRECISIONS)[number];

export interface EraYear { id: string; name: string; startYear: number | null }

export const DEFAULT_CALENDAR: WorldCalendar = {
    months: Array.from({ length: 12 }, (_, i) => ({ name: `เดือน ${i + 1}`, days: 30 })),
    anchor: null,
};

/** อ่านค่าจาก DB (jsonb อะไรก็ได้) ให้เป็นปฏิทินที่ใช้ได้เสมอ — ค่าพังตกไปใช้ค่าเริ่มต้น */
export function normalizeCalendar(raw: unknown): WorldCalendar {
    if (!raw || typeof raw !== "object") return DEFAULT_CALENDAR;
    const r = raw as Partial<WorldCalendar>;
    const months = Array.isArray(r.months)
        ? r.months
            .filter((m): m is CalendarMonth => !!m && typeof m.name === "string" && Number.isFinite(m.days))
            .map((m) => ({ name: m.name.trim() || "เดือน", days: Math.min(400, Math.max(1, Math.trunc(m.days))) }))
        : [];
    const usable = months.length > 0 ? months : DEFAULT_CALENDAR.months;
    const a = r.anchor;
    const anchor = a && [a.year, a.month, a.day].every(Number.isFinite)
        ? clampDate(usable, a.year, a.month, a.day)
        : null;
    return { months: usable, anchor };
}

export function yearLength(cal: WorldCalendar): number {
    return cal.months.reduce((s, m) => s + m.days, 0);
}

function clampDate(months: CalendarMonth[], year: number, month: number, day: number) {
    const m = Math.min(months.length, Math.max(1, Math.trunc(month)));
    const d = Math.min(months[m - 1].days, Math.max(1, Math.trunc(day)));
    return { year: Math.trunc(year), month: m, day: d };
}

/** ปี/เดือน/วัน (เดือนและวันเริ่มที่ 1) → เลขวันสัมบูรณ์ · เดือน/วันเกินช่วงถูกบีบให้อยู่ในช่วง */
export function dayOf(cal: WorldCalendar, year: number, month = 1, day = 1): number {
    const c = clampDate(cal.months, year, month, day);
    let before = 0;
    for (let i = 0; i < c.month - 1; i++) before += cal.months[i].days;
    return (c.year - 1) * yearLength(cal) + before + (c.day - 1);
}

export function fromDay(cal: WorldCalendar, dayNum: number): { year: number; month: number; day: number } {
    const len = yearLength(cal);
    const yearIdx = Math.floor(dayNum / len);
    let rest = dayNum - yearIdx * len;
    let month = 1;
    for (const m of cal.months) {
        if (rest < m.days) break;
        rest -= m.days;
        month++;
    }
    return { year: yearIdx + 1, month, day: rest + 1 };
}

/** ยุคที่ครอบปีนี้ = ยุคที่ startYear มากสุดแต่ไม่เกินปีนั้น · ยุคที่ยังไม่ตั้งปีไม่นับ */
export function eraForYear(eras: EraYear[], year: number): EraYear | null {
    let best: EraYear | null = null;
    for (const e of eras) {
        if (e.startYear == null || e.startYear > year) continue;
        if (!best || e.startYear > best.startYear!) best = e;
    }
    return best;
}

/** ปีสัมบูรณ์ → ข้อความ "ปี 342 ยุคเพลิง" (ถ้าไม่มียุคครอบ แสดงเป็นปีสัมบูรณ์) */
export function yearLabel(eras: EraYear[], year: number): string {
    const era = eraForYear(eras, year);
    return era ? `ปี ${year - era.startYear! + 1} ${era.name}` : `ปี ${year}`;
}

export function formatWorldTime(cal: WorldCalendar, eras: EraYear[], dayNum: number, precision: TimePrecision): string {
    const t = fromDay(cal, dayNum);
    const y = yearLabel(eras, t.year);
    if (precision === "year") return y;
    const m = cal.months[t.month - 1]?.name ?? `เดือน ${t.month}`;
    return precision === "month" ? `${m} ${y}` : `${t.day} ${m} ${y}`;
}

/** ฉากที่มี story_date → เลขวันในโลก (ต้องผูก anchor ไว้ก่อน ไม่งั้น null) */
export function sceneDay(cal: WorldCalendar, storyDate: number | null): number | null {
    if (storyDate == null || !cal.anchor) return null;
    return dayOf(cal, cal.anchor.year, cal.anchor.month, cal.anchor.day) + (storyDate - 1);
}

/** ระยะห่างแบบคนอ่าน — ใช้กับป้าย "≈ 300 ปี" บนแกน · ห่างไม่ถึงปี = null (ไม่ต้องแสดง) */
export function gapLabel(cal: WorldCalendar, fromDayNum: number, toDayNum: number): string | null {
    const years = (toDayNum - fromDayNum) / yearLength(cal);
    if (years < 1) return null;
    return `≈ ${years >= 10 ? Math.round(years).toLocaleString("th-TH") : years.toFixed(1).replace(/\.0$/, "")} ปี`;
}
