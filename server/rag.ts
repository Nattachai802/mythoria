"use server";

import { getContextBundle, type ResolvedReference } from "./references";
import { isEntityType, type EntityType } from "./registry/entity-registry";

/**
 * Context Fabric — Graph RAG retrieval
 * -----------------------------------
 * vector search ให้ "จุดเริ่ม" → เดิน references 1 ก้าว ดึงเพื่อนบ้าน → รวม
 * = context เชิงความหมาย (similar) + เชิงโครงสร้าง (connected)
 *
 * ของเดิม ai-review/plot-hole เรียก /search ตรงๆ (flat). ตัวนี้คือ Graph RAG รุ่นอัปเกรด
 */

const PYTHON = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

interface SearchHit {
    id: string;
    content_type: string;
    title: string;
    content: string;
    score: number;
}

export interface RetrievedItem {
    type: string;
    id: string;
    title: string;
    content?: string;
    score?: number;
    via: "search" | "graph"; // มาจาก vector หรือเดินเส้นเชื่อม
    relation?: string;        // ถ้ามาจาก graph: ต่อด้วย relation อะไร
}

export interface RetrieveResult {
    items: RetrievedItem[];
    contextString: string; // พร้อมยัด prompt
}

async function vectorSearch(novelId: string, query: string, limit: number): Promise<SearchHit[]> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`${PYTHON}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, novel_id: novelId, limit }),
            signal: controller.signal,
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    } finally {
        clearTimeout(t);
    }
}

/**
 * Graph RAG: หาของคล้าย แล้วเดินเส้นเชื่อม 1 ก้าวจาก hit อันดับต้นๆ
 */
export async function retrieveContext(
    novelId: string,
    query: string,
    opts?: { searchLimit?: number; expandTop?: number; neighborsPerHit?: number },
): Promise<RetrieveResult> {
    const searchLimit = opts?.searchLimit ?? 8;
    const expandTop = opts?.expandTop ?? 3;        // เดินเส้นจาก hit กี่อันแรก
    const neighborsPerHit = opts?.neighborsPerHit ?? 4;

    const hits = await vectorSearch(novelId, query, searchLimit);

    const items: RetrievedItem[] = [];
    const seen = new Set<string>(); // กันซ้ำข้าม search + graph

    // 1. vector hits = จุดเริ่ม
    for (const h of hits) {
        const key = `${h.content_type}:${h.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
            type: h.content_type, id: h.id, title: h.title,
            content: h.content, score: h.score, via: "search",
        });
    }

    // 2. เดินเส้นเชื่อม 1 ก้าว จาก hit อันดับต้นที่เป็น entity จริง
    const expandable = hits
        .filter((h) => isEntityType(h.content_type))
        .slice(0, expandTop);

    const bundles = await Promise.all(
        expandable.map((h) =>
            getContextBundle({ type: h.content_type as EntityType, id: h.id }),
        ),
    );

    for (const bundle of bundles) {
        const neighbors: ResolvedReference[] = [
            ...Object.values(bundle.outgoing).flat(),
            ...Object.values(bundle.incoming).flat(),
        ].slice(0, neighborsPerHit);

        for (const n of neighbors) {
            if (!n.entity) continue;
            const key = `${n.entity.type}:${n.entity.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({
                type: n.entity.type, id: n.entity.id, title: n.entity.title,
                via: "graph", relation: n.relation,
            });
        }
    }

    // 3. ประกอบ context string
    const contextString = items
        .map((it) =>
            it.via === "search"
                ? `[${it.type}] ${it.title}: ${it.content ?? ""}`
                : `[${it.type}] ${it.title} (เกี่ยวข้องผ่าน: ${it.relation})`,
        )
        .join("\n");

    return { items, contextString };
}
