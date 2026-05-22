"use client";

import { useEffect, useState } from "react";
import { Sparkles, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingIdeaPoolProps {
    ideas: string[]; // These are the names of new ideas created in the pool
}

export function FloatingIdeaPool({ ideas }: FloatingIdeaPoolProps) {
    const [bubbles, setBubbles] = useState<any[]>([]);

    useEffect(() => {
        if (!ideas || ideas.length === 0) {
            setBubbles([]);
            return;
        }

        const newBubbles = ideas.map((idea, i) => {
            return {
                id: i,
                text: idea,
                // Random position within safe bounds
                left: Math.floor(Math.random() * 70) + 10, // 10% to 80%
                top: Math.floor(Math.random() * 50) + 15, // 15% to 65%
                delay: Math.random() * 2,
                duration: Math.random() * 3 + 4, // 4 to 7 seconds
                scale: Math.random() * 0.3 + 0.8, // 0.8 to 1.1
            };
        });

        setBubbles(newBubbles);
    }, [ideas]);

    if (!ideas || ideas.length === 0) return null;

    return (
        <div className="mt-4 p-4 rounded-xl border bg-muted/30 relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes floatbubble {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(2deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }
            `}} />
            
            <div className="absolute top-3 left-4 flex items-center gap-2 text-primary z-10">
                <BrainCircuit className="w-5 h-5" />
                <span className="font-semibold text-sm">Idea Pool (ไอเดียใหม่ที่ถูกสกัด)</span>
            </div>

            {/* Floating Bubbles */}
            <div className="absolute inset-0 z-0">
                {bubbles.map(b => (
                    <div 
                        key={b.id}
                        className="absolute flex items-center justify-center px-4 py-2 rounded-2xl bg-background border border-primary/20 shadow-md text-sm font-medium text-foreground whitespace-nowrap cursor-pointer hover:border-primary/60 hover:shadow-lg transition-colors z-0"
                        style={{
                            left: `${b.left}%`,
                            top: `${b.top}%`,
                            animation: `floatbubble ${b.duration}s ease-in-out infinite`,
                            animationDelay: `${b.delay}s`,
                            transform: `scale(${b.scale})`
                        }}
                    >
                        <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                        {b.text}
                    </div>
                ))}
            </div>
            
            <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground z-10 bg-background/80 px-2 py-0.5 rounded-md backdrop-blur-sm">
                ไอเดียเหล่านี้ถูกบันทึกลงคลัง Idea ของโปรเจกต์อัตโนมัติ
            </div>
        </div>
    );
}
