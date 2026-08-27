import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiFeatureView } from "@/server/ai-control";

// export ให้ model-map-section.tsx ใช้ร่วม — กันสีป้าย provider เพี้ยนกันระหว่างจุด
export const PROVIDER_STYLE: Record<string, string> = {
    groq: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    typhoon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    gemini: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

// "12s" / "1m 30s" จาก ISO timestamp ที่เริ่มทำงาน — สั้นพอไม่แย่งที่แถวโควตา
function formatElapsed(sinceIso: string): string {
    const sec = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000));
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function AiFeatureCard({ feature }: { feature: AiFeatureView }) {
    const overQuota = feature.dailyLimit !== null && feature.usedToday >= feature.dailyLimit;

    return (
        <Card className={feature.enabled ? "" : "opacity-60"}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{feature.label}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {feature.description}
                        </p>
                    </div>
                    <Badge
                        variant={feature.enabled ? "default" : "destructive"}
                        className="text-[10px] shrink-0"
                    >
                        {feature.enabled ? "ON" : "OFF"}
                    </Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                    {feature.steps.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                            {i > 0 && <span className="text-[10px] text-muted-foreground">→</span>}
                            <Badge
                                variant="secondary"
                                className={`text-[10px] font-mono ${PROVIDER_STYLE[s.provider] ?? ""}`}
                                title={`${s.order}${s.temperature != null ? ` · temp ${s.temperature}` : ""}${
                                    s.maxTokens ? ` · max ${s.maxTokens} tok` : ""
                                }`}
                            >
                                {s.provider}/{s.model}
                            </Badge>
                        </span>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs border-t pt-2 flex-wrap">
                    <span className="flex items-center gap-2 flex-wrap">
                        <span className={overQuota ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {feature.usedToday.toLocaleString()}
                            {feature.dailyLimit !== null
                                ? ` / ${feature.dailyLimit.toLocaleString()} ครั้งวันนี้`
                                : " ครั้งวันนี้ · ไม่จำกัด"}
                        </span>
                        {feature.activeSince && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
                                กำลังทำงาน · {formatElapsed(feature.activeSince)}
                            </span>
                        )}
                    </span>
                    {feature.isOverridden && (
                        <Badge
                            variant="outline"
                            className="text-[10px]"
                            title={`override จาก CLI: ${feature.dailyLimit ?? "ไม่จำกัด"} (ค่า default: ${feature.defaultDailyLimit ?? "ไม่จำกัด"}) — npm run ai reset เพื่อคืน default`}
                        >
                            custom
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
