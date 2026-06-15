"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface VectorSyncButtonProps {
    novelId: string;
}

function NodeNetwork() {
    return (
        <div className="node-network">
            <svg viewBox="0 0 30 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="15" y1="4"  x2="26" y2="12" className="net-line l1" />
                <line x1="26" y1="12" x2="20" y2="27" className="net-line l2" />
                <line x1="15" y1="4"  x2="4"  y2="13" className="net-line l3" />
                <line x1="4"  y1="13" x2="10" y2="27" className="net-line l4" />
                <line x1="10" y1="27" x2="20" y2="27" className="net-line l5" />
                <line x1="4"  y1="13" x2="20" y2="27" className="net-line l6" />
                <line x1="15" y1="4"  x2="10" y2="27" className="net-line l7" />
                <circle cx="15" cy="4"  r="2.8" className="net-node n1" />
                <circle cx="26" cy="12" r="2.2" className="net-node n2" />
                <circle cx="20" cy="27" r="2.2" className="net-node n3" />
                <circle cx="10" cy="27" r="2.2" className="net-node n4" />
                <circle cx="4"  cy="13" r="2.2" className="net-node n5" />
            </svg>
            <style jsx>{`
                .node-network {
                    width: 2em;
                    height: 2.4em;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .node-network svg { width: 100%; height: 100%; overflow: visible; }
                .net-line {
                    stroke: hsl(223, 10%, 38%);
                    stroke-width: 0.9;
                    stroke-linecap: round;
                    opacity: 0.3;
                    animation: line-glow 3.6s ease-in-out infinite;
                }
                .net-node {
                    fill: hsl(223, 10%, 35%);
                    animation: node-glow 3.6s ease-in-out infinite;
                }
                .n1 { animation-delay: 0s; }
                .l1 { animation-delay: 0.2s; }
                .l3 { animation-delay: 0.2s; }
                .n2 { animation-delay: 0.45s; }
                .n5 { animation-delay: 0.45s; }
                .l2 { animation-delay: 0.7s; }
                .l4 { animation-delay: 0.7s; }
                .n3 { animation-delay: 0.95s; }
                .n4 { animation-delay: 0.95s; }
                .l5 { animation-delay: 1.2s; }
                .l6 { animation-delay: 1.2s; }
                .l7 { animation-delay: 1.4s; }
                @keyframes line-glow {
                    0%, 15%  { stroke: hsl(223, 10%, 38%); opacity: 0.25; stroke-width: 0.9; }
                    40%, 60% { stroke: hsl(48, 90%, 55%);  opacity: 0.9;  stroke-width: 1.3; }
                    85%, 100%{ stroke: hsl(223, 10%, 38%); opacity: 0.25; stroke-width: 0.9; }
                }
                @keyframes node-glow {
                    0%, 15%  { fill: hsl(223, 10%, 35%); }
                    40%, 60% { fill: hsl(48, 90%, 58%); filter: drop-shadow(0 0 2px hsl(48 90% 55% / 0.8)); }
                    85%, 100%{ fill: hsl(223, 10%, 35%); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .net-line { animation: none; opacity: 0.4; }
                    .net-node { animation: none; }
                }
            `}</style>
        </div>
    );
}

export function VectorSyncButton({ novelId }: VectorSyncButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const handleSync = async () => {
        setIsLoading(true);
        setStatus("idle");
        try {
            toast.info("กำลังซิงค์ข้อมูล...", { description: "สร้าง embeddings สำหรับเนื้อหาทั้งหมด" });
            const response = await fetch(`http://localhost:8000/sync/${novelId}`, { method: "POST" });
            const result = await response.json();
            if (result.success) {
                setStatus("success");
                toast.success("ซิงค์ข้อมูลสำเร็จ!", { description: `ซิงค์แล้ว ${result.synced} รายการ` });
            } else {
                setStatus("error");
                toast.error("ซิงค์ข้อมูลล้มเหลว", { description: result.errors?.[0] || "เกิดข้อผิดพลาด" });
            }
        } catch {
            setStatus("error");
            toast.error("ซิงค์ข้อมูลล้มเหลว", { description: "Python service ไม่ได้รัน (port 8000)" });
        } finally {
            setIsLoading(false);
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <div className="flex items-center gap-2.5 px-3 py-2">
            <NodeNetwork />
            <span className="flex-1 text-xs font-medium">ซิงค์ฐานข้อมูล AI</span>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={isLoading}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0 gap-1"
            >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 status === "success" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
                 status === "error" ? <XCircle className="h-3 w-3 text-destructive" /> : null}
                {isLoading ? "กำลังซิงค์..." : status === "success" ? "สำเร็จ" : status === "error" ? "ลองใหม่" : "ซิงค์ →"}
            </Button>
        </div>
    );
}
