import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiFeatureView } from "@/server/ai-control";

const PROVIDER_STYLE: Record<string, string> = {
    groq: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    typhoon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    gemini: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

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

                <div className="flex items-center justify-between gap-2 text-xs border-t pt-2">
                    <span className={overQuota ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {feature.usedToday.toLocaleString()}
                        {feature.dailyLimit !== null
                            ? ` / ${feature.dailyLimit.toLocaleString()} ครั้งวันนี้`
                            : " ครั้งวันนี้ · ไม่จำกัด"}
                    </span>
                    {feature.isOverridden && (
                        <Badge variant="outline" className="text-[10px]" title="มีค่า override จาก CLI — npm run ai reset เพื่อคืน default">
                            custom
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
