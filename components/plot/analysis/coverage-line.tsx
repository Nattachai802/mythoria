"use client";

interface CoverageLineProps {
    blockedSummary: string;
}

export function CoverageLine({ blockedSummary }: CoverageLineProps) {
    if (!blockedSummary) return null;
    return (
        <p aria-label="ฟิลด์ที่ยังตรวจไม่ได้" style={{ fontFamily: "var(--font-technical)", fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
            <span style={{ opacity: 0.6 }}>ยังตรวจไม่ได้</span>
            {" · "}
            {blockedSummary}
        </p>
    );
}
