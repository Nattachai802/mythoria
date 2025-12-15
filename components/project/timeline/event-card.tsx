"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TimelineEvent } from "@/db/schema"
import { Card } from "@/components/ui/card"
import { Clock, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
// removed Link import
import { useRouter } from "next/navigation"

interface EventCardProps {
    event: TimelineEvent
}

export function EventCard({ event }: EventCardProps) {
    const router = useRouter()
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: event.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative w-full flex justify-center group" // จัดกลาง
        >
            {/* --- จุด Connector บนเส้นกลาง (ทับเส้น Vertical) --- */}
            <div className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-0",
                "bg-background border-muted-foreground/40",
                isDragging && "bg-primary border-primary"
            )} />

            {/* --- เส้นเชื่อมแนวนอนจากกลางไปยัง Card --- */}
            {/* เราจะดัน Card ไปทางขวาเล็กน้อยเพื่อให้เห็นเส้น */}

            <Card className={cn(
                "relative ml-8 w-full p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 bg-card border-muted/60",
                isDragging && "shadow-xl ring-2 ring-primary/20 rotate-2 scale-105"
            )}>
                {/* เส้นเชื่อมเล็กๆ ด้านซ้ายของ Card */}
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-muted-foreground/30 -translate-y-1/2" />

                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity cursor-grab z-10"
                    onPointerDown={(e) => {
                        e.stopPropagation(); // Prevent drag from triggering Link logic
                        listeners?.onPointerDown?.(e);
                    }}
                >
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>

                <div
                    onClick={() => {
                        if (!isDragging) {
                            router.push(`/dashboard/project/${event.novelId}/plot/${event.id}`);
                        }
                    }}
                    className="cursor-pointer block"
                >
                    <div className="pr-6">
                        <h4 className="font-medium text-sm leading-snug mb-1 text-foreground/90 hover:text-primary transition-colors">
                            {event.title}
                        </h4>

                        {event.eventDate && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                                <Clock className="h-3 w-3" />
                                {event.eventDate}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    )
}