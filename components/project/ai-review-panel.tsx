"use client"

import { useState, useEffect } from "react"
import { Loader2, MessageSquare, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Review {
  id?: string
  persona: number
  personaName: string
  content: string
}

interface AIReviewPanelProps {
  noteId: string
  novelId: string
}

export function AIReviewPanel({ noteId, novelId }: AIReviewPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/novel/${novelId}/note/${noteId}/ai-review`)
      const data = await res.json()
      if (data.reviews && data.reviews.length > 0) {
        setReviews(data.reviews)
        setHasFetched(true)
      }
    } catch (error) {
      console.error("Failed to fetch reviews", error)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [noteId])

  const handleGenerate = async () => {
    setLoading(true)
    toast.info("กำลังเรียกให้นักอ่านมารีวิว (อาจใช้เวลาสักครู่)...")
    try {
      const res = await fetch(`/api/novel/${novelId}/note/${noteId}/ai-review`, {
        method: "POST"
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการสร้างรีวิว")
      }
      setReviews(data.reviews || [])
      setHasFetched(true)
      toast.success("นักอ่านรีวิวเสร็จแล้ว!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex flex-col border border-border shadow-sm">
      <CardHeader className="bg-muted/50 py-3 px-4 flex flex-row items-center justify-between border-b">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            แชทกลุ่มนักอ่าน (AI)
          </CardTitle>
          <CardDescription className="text-xs pt-1">ทดสอบฟีดแบคจาก 5 บุคลิก</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-7 w-7" 
          onClick={handleGenerate} 
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {!hasFetched && !loading ? (
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="bg-primary/10 p-3 rounded-full">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">ยังไม่มีการรีวิวเนื้อหาตอนนี้<br/>กดปุ่มด้านล่างเพื่อให้นักอ่าน AI เริ่มวิจารณ์</p>
            <Button size="sm" onClick={handleGenerate} disabled={loading} className="w-full">
              <Send className="h-3.5 w-3.5 mr-2" />
              ส่งให้อ่านเลย
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[350px] p-4 bg-muted/10">
            {loading && reviews.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full space-y-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs animate-pulse">นักอ่านกำลังตั้งใจอ่านและพิมพ์แชท...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((msg, idx) => {
                  const isPositive = msg.persona <= 2;
                  const isNeutral = msg.persona === 3;
                  const isNegative = msg.persona >= 4;

                  return (
                    <div key={idx} className={cn(
                      "flex flex-col gap-1 w-[90%]",
                      msg.persona % 2 === 0 ? "ml-auto items-end" : "mr-auto items-start"
                    )}>
                      <span className="text-[10px] text-muted-foreground px-1 font-medium">
                        {msg.personaName}
                      </span>
                      <div className={cn(
                        "p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                        msg.persona % 2 === 0 ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-card border border-border"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
