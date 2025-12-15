"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlotHoleJobButtonProps {
  novelId: string;
}

interface CheckProgress {
  currentNote: string;
  checked: number;
  total: number;
  isRunning: boolean;
}

export function PlotHoleJobButton({ novelId }: PlotHoleJobButtonProps) {
  const [progress, setProgress] = useState<CheckProgress>({
    currentNote: "",
    checked: 0,
    total: 0,
    isRunning: false,
  });
  const [result, setResult] = useState<{ success: boolean; checked: number } | null>(null);

  const handleCheck = async () => {
    setProgress({ currentNote: "กำลังเริ่มต้น...", checked: 0, total: 0, isRunning: true });
    setResult(null);

    try {
      // Start SSE connection for real-time updates
      const eventSource = new EventSource(
        `http://localhost:8000/check-all-notes-stream/${novelId}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          setProgress({
            currentNote: data.currentNote,
            checked: data.checked,
            total: data.total,
            isRunning: true,
          });
        } else if (data.type === "complete") {
          setProgress(prev => ({ ...prev, isRunning: false }));
          setResult({ success: true, checked: data.checked });
          eventSource.close();

          toast.success("ตรวจสอบเสร็จสิ้น!", {
            description: `ตรวจสอบ ${data.checked} notes`,
          });
        } else if (data.type === "error") {
          setProgress(prev => ({ ...prev, isRunning: false }));
          eventSource.close();
          toast.error("เกิดข้อผิดพลาด", { description: data.message });
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Fallback to non-streaming endpoint
        fallbackCheck();
      };

    } catch (error) {
      fallbackCheck();
    }
  };

  const fallbackCheck = async () => {
    try {
      const response = await fetch(`http://localhost:8000/check-all-notes/${novelId}`, {
        method: "POST",
      });
      const data = await response.json();

      setProgress(prev => ({ ...prev, isRunning: false }));

      if (data.success) {
        setResult({ success: true, checked: data.checked });
        toast.success("ตรวจสอบเสร็จสิ้น!", {
          description: `ตรวจสอบ ${data.checked} notes`,
        });
      }
    } catch {
      setProgress(prev => ({ ...prev, isRunning: false }));
      toast.error("ไม่สามารถเชื่อมต่อได้");
    }
  };

  return (
    <div className="space-y-3">
      {/* Main Button / Progress Display */}
      {progress.isRunning ? (
        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50">
          {/* Book Animation */}
          <BookLoader />

          {/* Progress Text */}
          <div className="text-center space-y-1">
            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
              กำลังตรวจสอบ Plot Holes...
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {progress.currentNote || "กำลังเริ่มต้น..."}
            </div>
            {progress.total > 0 && (
              <div className="text-xs text-muted-foreground">
                {progress.checked} / {progress.total} notes
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {progress.total > 0 && (
            <div className="w-full h-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${(progress.checked / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* Closed Book Icon */}
          <ClosedBook />

          <Button
            variant="outline"
            size="sm"
            onClick={handleCheck}
            className="gap-2 flex-1 justify-center bg-white/50 dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            {result?.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            ตรวจสอบ
          </Button>
        </div>
      )}

      {/* Result Summary */}
      {result && !progress.isRunning && (
        <div className="text-xs text-center text-muted-foreground">
          ตรวจสอบแล้ว {result.checked} notes
        </div>
      )}
    </div>
  );
}

// Closed Book Icon Component
function ClosedBook() {
  return (
    <div className="closed-book">
      <div className="book-closed">
        <div className="book-spine" />
        <div className="book-cover" />
        <div className="book-pages" />
      </div>

      <style jsx>{`
        .closed-book {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .book-closed {
          position: relative;
          width: 2em;
          height: 2.4em;
          transform-style: preserve-3d;
          transform: perspective(200px) rotateY(-5deg);
        }

        .book-spine {
          position: absolute;
          left: 0;
          width: 0.4em;
          height: 100%;
          background: linear-gradient(to right, hsl(271, 80%, 35%), hsl(271, 90%, 45%));
          border-radius: 0.1em 0 0 0.1em;
        }

        .book-cover {
          position: absolute;
          left: 0.35em;
          width: 1.6em;
          height: 100%;
          background: linear-gradient(135deg, hsl(278, 84%, 60%) 0%, hsl(271, 90%, 50%) 100%);
          border-radius: 0 0.12em 0.12em 0;
          box-shadow: 
            inset -0.15em 0 0.2em rgba(0,0,0,0.2),
            0.08em 0.08em 0.2em rgba(0,0,0,0.3);
        }

        .book-pages {
          position: absolute;
          left: 0.4em;
          top: 0.08em;
          width: 1.4em;
          height: calc(100% - 0.16em);
          background: linear-gradient(to right, 
            hsl(40, 30%, 95%) 0%, 
            hsl(40, 20%, 90%) 90%,
            hsl(40, 20%, 85%) 100%
          );
          border-radius: 0 0.08em 0.08em 0;
          box-shadow: inset 0.03em 0 0.08em rgba(0,0,0,0.1);
        }

        .book-pages::before {
          content: '';
          position: absolute;
          right: 0.15em;
          top: 20%;
          width: 0.8em;
          height: 60%;
          background: repeating-linear-gradient(
            to bottom,
            hsl(223, 10%, 20%) 0 0.04em,
            transparent 0.04em 0.16em
          );
          opacity: 0.15;
        }
      `}</style>
    </div>
  );
}

// Book Loading Animation Component
function BookLoader() {
  return (
    <div className="book-loader">
      <div className="book">
        <div className="book__pg-shadow" />
        <div className="book__pg" />
        <div className="book__pg book__pg--2" />
        <div className="book__pg book__pg--3" />
        <div className="book__pg book__pg--4" />
        <div className="book__pg book__pg--5" />
      </div>

      <style jsx>{`
        .book-loader {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.5rem;
        }

        .book,
        .book__pg-shadow,
        .book__pg {
          animation: cover 5s ease-in-out infinite;
        }

        .book {
          background-color: hsl(268, 90%, 65%);
          border-radius: 0.25em;
          box-shadow:
            0 0.25em 0.5em hsla(0, 0%, 0%, 0.3),
            0 0 0 0.25em hsl(278, 100%, 57%) inset;
          padding: 0.25em;
          perspective: 37.5em;
          position: relative;
          width: 4em;
          height: 3em;
          transform: translate3d(0, 0, 0);
          transform-style: preserve-3d;
        }

        .book__pg-shadow,
        .book__pg {
          position: absolute;
          left: 0.25em;
          width: calc(50% - 0.25em);
        }

        .book__pg-shadow {
          animation-name: shadow;
          background-image: linear-gradient(
            -45deg,
            hsla(0, 0%, 0%, 0) 50%,
            hsla(0, 0%, 0%, 0.3) 50%
          );
          filter: blur(0.25em);
          top: calc(100% - 0.25em);
          height: 1.875em;
          transform: scaleY(0);
          transform-origin: 100% 0%;
        }

        .book__pg {
          animation-name: pg1;
          background-color: hsl(223, 10%, 100%);
          background-image: linear-gradient(
            90deg,
            hsla(223, 10%, 90%, 0) 87.5%,
            hsl(223, 10%, 90%)
          );
          height: calc(100% - 0.5em);
          transform-origin: 100% 50%;
        }

        .book__pg--2,
        .book__pg--3,
        .book__pg--4 {
          background-image: repeating-linear-gradient(
              hsl(223, 10%, 10%) 0 0.0625em,
              hsla(223, 10%, 10%, 0) 0.0625em 0.25em
            ),
            linear-gradient(90deg, hsla(223, 10%, 90%, 0) 87.5%, hsl(223, 10%, 90%));
          background-repeat: no-repeat;
          background-position: center;
          background-size:
            1.25em 2em,
            100% 100%;
        }

        .book__pg--2 { animation-name: pg2; }
        .book__pg--3 { animation-name: pg3; }
        .book__pg--4 { animation-name: pg4; }
        .book__pg--5 { animation-name: pg5; }

        @keyframes cover {
          from, 5%, 45%, 55%, 95%, to {
            animation-timing-function: ease-out;
            background-color: hsl(278, 84%, 67%);
          }
          10%, 40%, 60%, 90% {
            animation-timing-function: ease-in;
            background-color: hsl(271, 90%, 45%);
          }
        }

        @keyframes shadow {
          from, 10.01%, 20.01%, 30.01%, 40.01% {
            animation-timing-function: ease-in;
            transform: translate3d(0, 0, 1px) scaleY(0) rotateY(0);
          }
          5%, 15%, 25%, 35%, 45%, 55%, 65%, 75%, 85%, 95% {
            animation-timing-function: ease-out;
            transform: translate3d(0, 0, 1px) scaleY(0.2) rotateY(90deg);
          }
          10%, 20%, 30%, 40%, 50%, to {
            animation-timing-function: ease-out;
            transform: translate3d(0, 0, 1px) scaleY(0) rotateY(180deg);
          }
          50.01%, 60.01%, 70.01%, 80.01%, 90.01% {
            animation-timing-function: ease-in;
            transform: translate3d(0, 0, 1px) scaleY(0) rotateY(180deg);
          }
          60%, 70%, 80%, 90%, to {
            animation-timing-function: ease-out;
            transform: translate3d(0, 0, 1px) scaleY(0) rotateY(0);
          }
        }

        @keyframes pg1 {
          from, to {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.4deg);
          }
          10%, 15% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(180deg);
          }
          20%, 80% {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(180deg);
          }
          85%, 90% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(180deg);
          }
        }

        @keyframes pg2 {
          from, to {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(0.3deg);
          }
          5%, 10% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.3deg);
          }
          20%, 25% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.9deg);
          }
          30%, 70% {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(179.9deg);
          }
          75%, 80% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.9deg);
          }
          90%, 95% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.3deg);
          }
        }

        @keyframes pg3 {
          from, 10%, 90%, to {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(0.2deg);
          }
          15%, 20% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.2deg);
          }
          30%, 35% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.8deg);
          }
          40%, 60% {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(179.8deg);
          }
          65%, 70% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.8deg);
          }
          80%, 85% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.2deg);
          }
        }

        @keyframes pg4 {
          from, 20%, 80%, to {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(0.1deg);
          }
          25%, 30% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.1deg);
          }
          40%, 45% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.7deg);
          }
          50% {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(179.7deg);
          }
          55%, 60% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.7deg);
          }
          70%, 75% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0.1deg);
          }
        }

        @keyframes pg5 {
          from, 30%, 70%, to {
            animation-timing-function: ease-in;
            background-color: hsl(223, 10%, 45%);
            transform: translate3d(0, 0, 1px) rotateY(0);
          }
          35%, 40% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0deg);
          }
          50% {
            animation-timing-function: ease-in-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(179.6deg);
          }
          60%, 65% {
            animation-timing-function: ease-out;
            background-color: hsl(223, 10%, 100%);
            transform: translate3d(0, 0, 1px) rotateY(0);
          }
        }
      `}</style>
    </div>
  );
}
