/**
 * ตัววิเคราะห์พล็อต — Phase 1 (docs/plot-analysis-plan.md)
 *
 * ทั้งหมดเป็นเลขคณิตล้วน ไม่เรียกโมเดล ไม่มี side effect
 * อ่านจาก Story Format (buildSceneFormat) ไม่ใช่ canvas_data ดิบ
 * เพื่อให้ตรรกะการอ่านเป็นชุดเดียวกับ export Markdown
 *
 * กฎการรายงาน (ข้อบังคับของแผน): แสดงหลักฐาน อย่าแสดงคะแนน
 * ทุก message ต้องเล่าตัวเลขที่นับได้ ไม่ใช่คำตัดสิน
 */

import { FORMAT_VERSION, type SceneFormat, type FormatBeat } from "./story-format";

// ─── Types ─────────────────────────────────────────────────────────────

export interface PlotFinding {
    checkId: string;           // "threads_unpaid" | "single_lane" | ...
    sceneId: string | null;    // null = ระดับทั้งเรื่อง
    subjectRef: string;        // รหัสการ์ด/ปม/ชื่อ ที่ธงนี้ชี้ถึง — คีย์จับคู่ verdict
    message: string;           // ข้อสังเกต อ่านได้เลยไม่ต้องมี context
    evidence: Record<string, unknown>;
}

export interface CoverageRow {
    field: string;             // ชื่อฟิลด์ที่ผู้เขียนรู้จัก
    filled: number;
    total: number;
    unlocks: string;           // "กรอกเพิ่มแล้วปลดล็อกอะไร"
}

export interface CoverageReport {
    rows: CoverageRow[];
    /** บรรทัดเดียวท้ายกล่อง: "ยังตรวจไม่ได้ · เวลาเร่งไหม 0/5 · มุมมอง 0/5" */
    blockedSummary: string;
}

export interface SceneSpineEntry {
    sceneId: string;
    title: string;
    cardCount: number;
    lanesUsed: number;
    threadCount: number;
    findingCount: number;
}

export interface PlotAnalysisReport {
    formatVersion: string;
    sceneCount: number;
    cardCount: number;
    threadCount: number;
    spine: SceneSpineEntry[];
    findings: PlotFinding[];
    coverage: CoverageReport;
}

/** ข้อมูลความครอบคลุม (ข้อ 1.0) — ฟิลด์พวกนี้อยู่บน timeline_events ไม่ได้อยู่ใน SceneFormat */
export interface CoverageInput {
    scenes: Array<{
        id: string;
        hasSceneGoal: boolean;
        hasStoryTimeIndex: boolean;
        hasStoryDuration: boolean;
        hasPovCharacterId: boolean;
        keyMomentCount: number;   // จำนวนการ์ดที่ปัก keyMomentLabel
        cardCount: number;        // การ์ดจริง (ไม่นับ sticky note)
    }>;
    threads: Array<{ id: string; boundBeatCount: number }>; // beat ที่ผูก canvasItemId แล้ว
}

export function buildCoverageReport(input: CoverageInput): CoverageReport {
    const total = input.scenes.length;
    const sum = (f: (s: CoverageInput["scenes"][number]) => boolean | number) =>
        input.scenes.reduce((acc, s) => acc + (typeof f(s) === "number" ? (f(s) as number) : (f(s) ? 1 : 0)), 0);

    const spec: Array<{ field: string; unlocks: string; filled: number; total: number }> = [
        { field: "เป้าหมายฉาก", unlocks: "เทียนเหตุการณ์ในฉากกับเป้าหมายที่ตั้งไว้", filled: sum(s => s.hasSceneGoal), total },
        { field: "ลำดับเวลา", unlocks: "ตรวจลำดับเวลาเล่า vs เวลาเกิดจริง (flashback)", filled: sum(s => s.hasStoryTimeIndex), total },
        { field: "ระยะเวลาในเรื่อง", unlocks: "ตรวจเวลาเร่ง — เดินทางเร็วผิดปกติ timeskip ที่มองไม่เห็น", filled: sum(s => s.hasStoryDuration), total },
        { field: "มุมมอง (POV)", unlocks: "ตรวจสลับมุมมองกลางฉาก", filled: sum(s => s.hasPovCharacterId), total },
        {
            field: "จุดหักเห",
            unlocks: "เทียบจุดหักเหกับที่ผู้เขียนปักไว้เอง",
            filled: sum(s => s.keyMomentCount),
            total: input.scenes.reduce((a, s) => a + s.cardCount, 0),
        },
        {
            field: "ปมผูกกับการ์ด",
            unlocks: "รู้ว่าปมถูกหว่าน/ย้ำ/เฉลยที่จังหวะไหน",
            filled: input.threads.reduce((a, t) => a + t.boundBeatCount, 0),
            total: input.threads.length ? input.threads.length * Math.max(total, 1) : 0,
        },
    ];

    const rows: CoverageRow[] = spec.map(s => ({ field: s.field, filled: s.filled, total: s.total, unlocks: s.unlocks }));

    const blocked = spec
        .filter(s => s.total > 0 && s.filled === 0)
        .map(s => `${s.field} 0/${s.total}`);
    return { rows, blockedSummary: blocked.join(" · ") };
}

// ─── Helpers ───────────────────────────────────────────────────────────

const realBeats = (f: SceneFormat) => f.beats.filter(b => !b.isBoardNote);

// ─── 1.1 ปมที่หว่านแล้วไม่เฉลย ──────────────────────────────────────────

function checkThreadsUnpaid(scenes: SceneFormat[]): PlotFinding[] {
    // threads ในทุก SceneFormat คือชุดเดียวกัน (roles ต่างกันตามฉาก)
    const threads = scenes[0]?.threads ?? [];
    return threads
        .filter(t => t.dangling)
        .map(t => {
            // รวมจุดแตะจากทุกฉาก: {sceneIndex, code, roles}
            const touches: Array<{ scene: number; code: string; roles: string[] }> = [];
            scenes.forEach((f, si) => {
                const ft = f.threads.find(x => x.id === t.id);
                if (!ft) return;
                const codes = new Set(ft.danglingAtCards);
                if (codes.size) touches.push({ scene: si + 1, code: [...codes].join(" "), roles: ft.roles });
            });
            const everTouched = scenes.some(f => {
                const ft = f.threads.find(x => x.id === t.id);
                return ft && ft.roles.length > 0;
            });
            const message = !everTouched
                ? `ปม "${t.title}" ยังไม่ได้ผูกกับจังหวะไหนเลย`
                : touches.length
                    ? `ปม "${t.title}" แตะไว้ที่ ${touches.map(x => `ฉาก ${x.scene} [${x.code}]`).join(" ")} ยังไม่มีจังหวะไหนเฉลย`
                    : `ปม "${t.title}" ย้ำไว้แต่ยังไม่มีจังหวะไหนเฉลย`;
            return {
                checkId: "threads_unpaid",
                sceneId: null,
                subjectRef: t.id,
                message,
                evidence: { title: t.title, status: t.status, touches },
            };
        });
}

// ─── 1.2 ตัวละครที่โผล่แล้วหายไป ────────────────────────────────────────

function checkVanishedParticipants(scenes: SceneFormat[]): PlotFinding[] {
    // การ์ดที่มีเส้นเชื่อมเข้าหรือออก (เชื่อมกับโครงเรื่อง) และการ์ดที่แตะปม
    const connectedCardIds = new Set<string>();
    scenes.forEach(f => f.beats.forEach(b => {
        if (b.links.length) connectedCardIds.add(`${f.scene.id}:${b.id}`);
        b.links.forEach(l => {
            const target = f.beats.find(x => x.code === l.toCode);
            if (target) connectedCardIds.add(`${f.scene.id}:${target.id}`);
        });
    }));
    const inThreadCardIds = new Set<string>();
    scenes.forEach(f => f.beats.forEach(b => {
        if (b.threadTouches.length) inThreadCardIds.add(`${f.scene.id}:${b.id}`);
    }));

    // นับการโผล่ของผู้ร่วมฉากตาม (type, name) — คนละชนิดชื่อพ้องเป็นคนละคน ตาม cast
    type Key = string;
    const appear = new Map<Key, { name: string; type: string; beats: FormatBeat[]; sceneTitles: string[] }>();
    scenes.forEach(f => realBeats(f).forEach(b => b.participants.forEach(p => {
        const k = `${p.type}\u0000${p.name}`;
        const e = appear.get(k) ?? { name: p.name, type: p.type, beats: [], sceneTitles: [] };
        e.beats.push(b); e.sceneTitles.push(f.scene.title);
        appear.set(k, e);
    })));

    const findings: PlotFinding[] = [];
    appear.forEach(e => {
        if (e.beats.length !== 1) return;
        const b = e.beats[0];
        const cardKey = `${scenes.find(f => f.beats.some(x => x.id === b.id))?.scene.id ?? ""}:${b.id}`;
        if (connectedCardIds.has(cardKey) || inThreadCardIds.has(cardKey)) return;
        findings.push({
            checkId: "vanished_participant",
            sceneId: null,
            subjectRef: e.name,
            message: `${e.type} "${e.name}" โผล่การ์ดเดียว (${b.code} ใน "${e.sceneTitles[0]}") ไม่อยู่ในปมใด ไม่เป็นปลายทางของเส้นเชื่อม`,
            evidence: { name: e.name, type: e.type, code: b.code, scene: e.sceneTitles[0] },
        });
    });
    return findings;
}

// ─── 1.3 ฉากเส้นเดียว ──────────────────────────────────────────────────

function lanesUsedPerScene(f: SceneFormat): number {
    return new Set(realBeats(f).map(b => b.lane)).size;
}

function checkSingleLane(scenes: SceneFormat[]): PlotFinding[] {
    const singles = scenes.filter(f => lanesUsedPerScene(f) === 1 && realBeats(f).length > 0);
    if (!singles.length) return [];
    return [{
        checkId: "single_lane",
        sceneId: null,
        subjectRef: "all",
        message: `${singles.length}/${scenes.length} ฉากเดินเลนเดียวตลอด (${singles.map(f => `"${f.scene.title}"`).join(" ")}) — นิยายลงเป็นตอนเดินเลนเดียวได้ตามปกติ เป็นข้อสังเกตไม่ใช่ข้อบกพร่อง`,
        evidence: { singleScenes: singles.map(f => f.scene.id), sceneCount: scenes.length },
    }];
}

// ─── 1.4 ฉากที่โครงซ้ำกัน ──────────────────────────────────────────────

function sceneSignature(f: SceneFormat): string {
    // โครงร่างโดยไม่แตะเนื้อความ: บทบาทปมต่อจังหวะ · จำนวนเลน · จำนวนจังหวะ · ชนิดเส้นเชื่อม
    const rolesSeq = realBeats(f).map(b => b.threadTouches.map(t => t.role).sort().join("+") || "-").join(">");
    const lanes = lanesUsedPerScene(f);
    const kinds = [...new Set(f.beats.flatMap(b => b.links.map(l => l.kind)))].sort().join(",");
    return `${rolesSeq}|${lanes}|${f.beatCount}|${kinds}`;
}

function checkRepetitiveShape(scenes: SceneFormat[]): PlotFinding[] {
    const groups = new Map<string, SceneFormat[]>();
    scenes.forEach(f => {
        const sig = sceneSignature(f);
        groups.set(sig, [...(groups.get(sig) ?? []), f]);
    });
    const findings: PlotFinding[] = [];
    groups.forEach(group => {
        if (group.length < 2) return;
        const names = group.map(f => `"${f.scene.title}"`).join(" ");
        findings.push({
            checkId: "repetitive_shape",
            sceneId: null,
            subjectRef: group.map(f => f.scene.id).sort().join(","),
            message: `${group.length} ฉากโครงร่างเหมือนกันเป๊ะ (${names}) — ลำดับบทบาทปม จำนวนเลน จำนวนจังหวะ และชนิดเส้นเชื่อมตรงกันทุกอย่าง`,
            evidence: { signature: sceneSignature(group[0]), scenes: group.map(f => f.scene.id) },
        });
    });
    return findings;
}

// ─── 1.5 จังหวะที่ไม่มีอะไรเกิดขึ้น ────────────────────────────────────

function checkNameOnlyBeats(scenes: SceneFormat[]): PlotFinding[] {
    const findings: PlotFinding[] = [];
    scenes.forEach(f => realBeats(f).forEach(b => {
        const content = b.content ?? "";
        if (content.length < 50) return; // ข้อความสั้นวัดสัดส่วนไม่มีความหมาย
        let nameChars = 0;
        b.participants.forEach(p => {
            const re = new RegExp(p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
            nameChars += (content.match(re) ?? []).length * p.name.length;
        });
        const pct = Math.round((nameChars / content.length) * 100);
        if (pct >= 50) {
            findings.push({
                checkId: "name_only_beat",
                sceneId: f.scene.id,
                subjectRef: b.code,
                message: `เนื้อความ [${b.code}] "${f.scene.title}" ยาว ${content.length} ตัวอักษร และ ${pct}% เป็นชื่อผู้ร่วมฉาก — รายชื่อคนที่ยังไม่มีใครทำอะไร`,
                evidence: { code: b.code, scene: f.scene.title, contentLength: content.length, nameCharPct: pct },
            });
        }
    }));
    return findings;
}

// ─── รวม ────────────────────────────────────────────────────────────────

export function analyzePlot(scenes: SceneFormat[], coverage: CoverageInput): PlotAnalysisReport {
    const findings = [
        ...checkThreadsUnpaid(scenes),
        ...checkVanishedParticipants(scenes),
        ...checkSingleLane(scenes),
        ...checkRepetitiveShape(scenes),
        ...checkNameOnlyBeats(scenes),
    ];

    const spine: SceneSpineEntry[] = scenes.map(f => ({
        sceneId: f.scene.id,
        title: f.scene.title,
        cardCount: realBeats(f).length,
        lanesUsed: lanesUsedPerScene(f),
        threadCount: f.threads.filter(t => t.roles.length > 0).length,
        findingCount: findings.filter(x => x.sceneId === f.scene.id).length,
    }));

    const cardCount = scenes.reduce((a, f) => a + realBeats(f).length, 0);

    return {
        formatVersion: FORMAT_VERSION,
        sceneCount: scenes.length,
        cardCount,
        threadCount: scenes[0]?.threads.length ?? 0,
        spine,
        findings,
        coverage: buildCoverageReport(coverage),
    };
}
