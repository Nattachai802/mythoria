"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StylometryData {
    id: string;
    chapterId: string;
    chapterTitle: string;
    orderIndex: number;
    pacingAndMood: any;
    authorNarrationStyle: any;
    characterDialogueVibes: any;
    lexicalRichness: any;
    chapterAnatomy: any;
}

interface StylometryDashboardProps {
    data: StylometryData[];
}

export function StylometryDashboard({ data }: StylometryDashboardProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 mt-8 text-center border rounded-lg border-dashed bg-muted/20">
                <BarChart3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-bold">ยังไม่มีข้อมูลการวิเคราะห์สไตล์การเขียน</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">
                    ไปที่หน้าต่างแต่งนิยายในแต่ละตอน และกดปุ่ม <strong className="text-purple-600">"วิเคราะห์ลีลาการเขียน"</strong> เพื่อนำข้อมูลเชิงลึกมาแสดงผลเปรียบเทียบที่นี่
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 mt-4">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h2 className="text-2xl font-bold">วิเคราะห์ลีลาการเขียน (Stylometry)</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        ภาพรวมสไตล์การเล่าเรื่อง, อารมณ์, และการใช้คำศัพท์เปรียบเทียบแต่ละตอน
                    </p>
                </div>
                <div className="text-sm px-4 py-2 bg-purple-50 text-purple-700 rounded-lg flex gap-2 items-center">
                    <Info className="w-4 h-4" />
                    วิเคราะห์แล้ว {data.length} ตอน
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle>ความหลากหลายของคำศัพท์ (Lexical Richness / TTR)</CardTitle>
                        <CardDescription>กราฟแสดงสัดส่วนคำศัพท์ไม่ซ้ำ (Unique Words) เปรียบเทียบกับจำนวนคำทั้งหมดของแต่ละตอน ยิ่งสูงยิ่งใช้ศัพท์หลากหลาย</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {(() => {
                            const ttrValues = data.map(i => i.lexicalRichness?.type_token_ratio_percentage || 0);
                            const maxTTR = Math.max(...ttrValues);
                            const minTTR = Math.min(...ttrValues);
                            const maxIdx = ttrValues.indexOf(maxTTR);
                            const minIdx = ttrValues.indexOf(minTTR);
                            
                            const svgW = 1000;
                            const svgH = 180;
                            const padL = 48, padR = 24, padT = 20, padB = 24;
                            const chartW = svgW - padL - padR;
                            const chartH = svgH - padT - padB;
                            const range = (maxTTR - minTTR) || 1;
                            
                            const toX = (idx: number) => padL + (idx / (data.length - 1 || 1)) * chartW;
                            const toY = (val: number) => padT + chartH - ((val - minTTR) / range) * chartH;

                            const points = data.map((item, idx) => ({
                                x: toX(idx),
                                y: toY(item.lexicalRichness?.type_token_ratio_percentage || 0),
                                ttr: item.lexicalRichness?.type_token_ratio_percentage || 0,
                                title: item.chapterTitle,
                                id: item.id,
                            }));

                            // Smooth cubic bezier path
                            const pathD = points.reduce((acc, p, i) => {
                                if (i === 0) return `M${p.x},${p.y}`;
                                const prev = points[i - 1];
                                const cpX = (prev.x + p.x) / 2;
                                return acc + ` C${cpX},${prev.y} ${cpX},${p.y} ${p.x},${p.y}`;
                            }, '');
                            
                            const areaD = pathD + ` L${points[points.length-1].x},${padT + chartH} L${padL},${padT + chartH} Z`;

                            return (
                                <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50 p-4">
                                    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: 180 }}>
                                        <defs>
                                            <linearGradient id="ttr-line-gradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="hsl(252,87%,73%)" />
                                                <stop offset="100%" stopColor="hsl(199,89%,60%)" />
                                            </linearGradient>
                                            <linearGradient id="ttr-area-gradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="hsl(252,87%,73%)" stopOpacity="0.18" />
                                                <stop offset="100%" stopColor="hsl(252,87%,73%)" stopOpacity="0" />
                                            </linearGradient>
                                            <filter id="glow">
                                                <feGaussianBlur stdDeviation="2" result="blur" />
                                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                            </filter>
                                        </defs>

                                        {/* Y-axis grid lines */}
                                        {[0, 0.5, 1].map((pct) => {
                                            const y = padT + chartH * (1 - pct);
                                            const val = minTTR + pct * range;
                                            return (
                                                <g key={pct}>
                                                    <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 6" className="text-muted-foreground/20" />
                                                    <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" className="fill-muted-foreground/50 font-mono">{val.toFixed(0)}%</text>
                                                </g>
                                            );
                                        })}

                                        {/* Area fill */}
                                        <path d={areaD} fill="url(#ttr-area-gradient)" />

                                        {/* Main line with gradient stroke */}
                                        <path d={pathD} fill="none" stroke="url(#ttr-line-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

                                        {/* All dots */}
                                        {points.map((p, i) => (
                                            <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="hsl(252,87%,73%)" opacity="0.5">
                                                <title>{`${p.title}: ${p.ttr}%`}</title>
                                            </circle>
                                        ))}

                                        {/* Max highlight */}
                                        <circle cx={points[maxIdx].x} cy={points[maxIdx].y} r="6" fill="hsl(142,72%,50%)" opacity="0.9" filter="url(#glow)">
                                            <title>{`สูงสุด: ${points[maxIdx].title} (${maxTTR}%)`}</title>
                                        </circle>
                                        <text x={points[maxIdx].x} y={points[maxIdx].y - 10} textAnchor="middle" fontSize="10" fill="hsl(142,72%,50%)" fontWeight="600">{maxTTR}%</text>

                                        {/* Min highlight */}
                                        <circle cx={points[minIdx].x} cy={points[minIdx].y} r="6" fill="hsl(0,72%,65%)" opacity="0.9" filter="url(#glow)">
                                            <title>{`ต่ำสุด: ${points[minIdx].title} (${minTTR}%)`}</title>
                                        </circle>
                                        <text x={points[minIdx].x} y={points[minIdx].y + 18} textAnchor="middle" fontSize="10" fill="hsl(0,72%,65%)" fontWeight="600">{minTTR}%</text>
                                    </svg>
                                    
                                    <div className="flex items-center justify-between mt-1 px-1">
                                        <span className="text-[10px] text-muted-foreground/50 tracking-widest uppercase"># 1</span>
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1.5 text-[10px] text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />สูงสุด</span>
                                            <span className="flex items-center gap-1.5 text-[10px] text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />ต่ำสุด</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/50 tracking-widest uppercase"># {data.length}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>จังหวะการเดินเรื่อง (Showing vs Telling)</CardTitle>
                        <CardDescription>ดุลยภาพระหว่างบทบรรยายและบทสนทนา</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-5">
                            {data.map((item) => {
                               const dialogRatio = item.chapterAnatomy?.dialogue_ratio_percentage || 0;
                               const narrationRatio = item.chapterAnatomy?.narration_ratio_percentage || 0;
                               return (
                                   <div key={item.id} className="space-y-1.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium truncate max-w-[150px]" title={item.chapterTitle}>{item.chapterTitle}</span>
                                            <span className="text-xs text-muted-foreground">{item.chapterAnatomy?.genre_prediction_hint?.split(' ')[0] || "N/A"}</span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-100 rounded-full flex overflow-hidden">
                                            <div className="bg-blue-400 h-full" style={{ width: `${narrationRatio}%` }} title={`บรรยาย ${narrationRatio}%`} />
                                            <div className="bg-emerald-400 h-full" style={{ width: `${dialogRatio}%` }} title={`สนทนา ${dialogRatio}%`} />
                                        </div>
                                   </div>
                               )
                           })}
                       </div>
                       <div className="flex gap-4 mt-6 text-sm text-muted-foreground justify-center">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-400" /> บทบรรยาย</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-400" /> บทสนทนา</div>
                       </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>อารมณ์และบรรยากาศ (Pacing & Mood)</CardTitle>
                        <CardDescription>การประเมินจากเครื่องหมายวรรคตอนและน้ำเสียง</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-4">
                            {data.map((item) => {
                               const mood = item.pacingAndMood?.vibe || "ไม่มีข้อมูล";
                               const charVibe = item.characterDialogueVibes?.vibe || "ไม่มีข้อมูล";
                               return (
                                   <div key={item.id} className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                                        <h4 className="font-medium text-sm mb-2">{item.chapterTitle}</h4>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground block mb-1">ภาพรวมของตอน</span>
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{mood.split('(')[0]}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block mb-1">บรรยากาศตัวละคร</span>
                                                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 font-medium text-purple-700">{charVibe.split('(')[0]}</span>
                                            </div>
                                        </div>
                                   </div>
                               )
                           })}
                       </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
