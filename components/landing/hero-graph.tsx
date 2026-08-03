import { TYPE_META } from "@/lib/graph-meta";

/**
 * กราฟจำลองสำหรับ hero — โครงเรื่องหนึ่งเรื่องที่เชื่อมกันทั้งวง
 *
 * ponytail: SVG นิ่ง + CSS animation ล้วน ไม่ดึงข้อมูลจริง ไม่โหลด react-force-graph
 * (ตำแหน่งโหนด hardcode) — ถ้าอยากให้เป็นกราฟของนิยายเดโมจริงค่อยเปลี่ยนทีหลัง
 * แต่จะแลกมาด้วย bundle ของ force-graph + เวลาโหลดบนหน้าแรก
 * สีดึงจาก lib/graph-meta ชุดเดียวกับกราฟจริง — คนที่กดเข้าไปจะเจอสีเดิม
 */

type Node = { id: string; type: keyof typeof TYPE_META | string; label: string; x: number; y: number; r: number };

const NODES: Node[] = [
    { id: "a", type: "character", label: "อาริยา", x: 300, y: 190, r: 26 },
    { id: "b", type: "character", label: "ชายไร้ชื่อ", x: 470, y: 105, r: 19 },
    { id: "c", type: "character", label: "ผู้ว่าเมือง", x: 140, y: 105, r: 19 },
    { id: "d", type: "location", label: "หอคอยเหนือ", x: 465, y: 285, r: 22 },
    { id: "e", type: "lore", label: "ตำนานระฆัง", x: 135, y: 285, r: 20 },
    { id: "f", type: "plotThread", label: "ปมพ่อหาย", x: 300, y: 350, r: 17 },
    { id: "g", type: "chapter", label: "บทที่ 1", x: 560, y: 195, r: 14 },
    { id: "h", type: "timelineEvent", label: "คืนระฆังดัง", x: 45, y: 195, r: 14 },
];

const LINKS: [string, string][] = [
    ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"], ["a", "f"],
    ["b", "d"], ["b", "g"], ["c", "e"], ["e", "h"], ["d", "g"], ["f", "h"],
];

const byId = (id: string) => NODES.find((n) => n.id === id)!;
const color = (type: string) => TYPE_META[type]?.color ?? "#71717a";

export function HeroGraph() {
    return (
        <svg
            viewBox="0 0 610 400"
            className="w-full h-auto max-w-2xl mx-auto select-none"
            role="img"
            aria-label="ตัวอย่างกราฟความเชื่อมโยง: ตัวละคร สถานที่ ตำนาน และปม เชื่อมถึงกันทั้งเรื่อง"
        >
            <defs>
                <radialGradient id="hero-halo">
                    <stop offset="0%" stopColor="var(--forge-gold)" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="var(--forge-gold)" stopOpacity="0" />
                </radialGradient>
            </defs>

            <circle cx="300" cy="200" r="230" fill="url(#hero-halo)" />

            {LINKS.map(([from, to], i) => {
                const a = byId(from);
                const b = byId(to);
                return (
                    <line
                        key={`${from}-${to}`}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="currentColor"
                        strokeWidth={1}
                        className="text-foreground/25 hero-edge"
                        style={{ animationDelay: `${i * 0.18}s` }}
                    />
                );
            })}

            {NODES.map((n, i) => (
                <g key={n.id} className="hero-node" style={{ animationDelay: `${i * 0.4}s` }}>
                    <circle cx={n.x} cy={n.y} r={n.r + 5} fill={color(n.type)} opacity={0.14} />
                    <circle cx={n.x} cy={n.y} r={n.r} fill={color(n.type)} opacity={0.9} />
                    <text
                        x={n.x}
                        y={n.y + n.r + 17}
                        textAnchor="middle"
                        className="fill-foreground/70 text-[11px]"
                    >
                        {n.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}
