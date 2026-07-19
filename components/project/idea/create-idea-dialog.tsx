"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Lightbulb, MessageCircle, BookOpen, User, Globe, Shuffle, type LucideIcon } from "lucide-react";
import { createIdea } from "@/server/idea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon }> = {
  general: { label: "ทั่วไป", icon: MessageCircle },
  plot: { label: "โครงเรื่อง", icon: BookOpen },
  character: { label: "ตัวละคร", icon: User },
  worldbuilding: { label: "โลก/ระบบ", icon: Globe },
  subplot: { label: "เนื้อเรื่องรอง", icon: Shuffle },
};

const ideaSchema = z.object({
  title: z.string().min(1, "ใส่หัวข้อไอเดียก่อนนะครับ"),
  content: z.string().min(1, "ใส่รายละเอียดไอเดียก่อนนะครับ"),
  category: z.string().default("general"),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

interface CreateIdeaDialogProps {
  novelId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultLinkedCharacterIds?: string[];
  defaultCategory?: string;
  onIdeaCreated?: (idea: any) => void;
  // slot เสริม render ในฟอร์ม (เช่น ตัวเลือกจังหวะบน plot board) — ที่อื่นไม่ส่งก็ไม่มีอะไรเพิ่ม
  extraContent?: React.ReactNode;
}

export function CreateIdeaDialog({
  novelId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultLinkedCharacterIds,
  defaultCategory,
  onIdeaCreated,
  extraContent,
}: CreateIdeaDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const form = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
    defaultValues: {
      title: "",
      content: "",
      category: defaultCategory || "general",
    },
  });

  const onSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);

    const result = await createIdea({
      title: data.title,
      content: data.content,
      novelId,
      category: data.category,
      linkedCharacterIds: defaultLinkedCharacterIds,
    });

    if (result.success) {
      toast.success("สร้างไอเดียแล้ว");
      onIdeaCreated?.(result.data);
      setOpen(false);
      form.reset();
    } else {
      toast.error(result.error || "สร้างไอเดียไม่สำเร็จ");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="forge" className="chamfered-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            ไอเดียใหม่
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto p-0 gap-0 noise-texture-strong border-steel-800">
        <DialogHeader className="px-5 py-3.5 border-b border-steel-800 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="h-7 w-7 chamfered-sm grid place-items-center bg-[var(--forge-amber)]/15 text-[var(--forge-amber)] shrink-0">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <span className="font-technical text-[11px] uppercase tracking-[0.14em] text-[var(--forge-amber)]">สร้างไอเดียใหม่</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-3.5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">หัวข้อ *</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ตัวร้ายมีอดีตร่วมกับพระเอก" className="h-8 text-sm border-steel-800" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn("grid gap-3", extraContent && "grid-cols-2 items-start")}>
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">หมวด</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs border-steel-800">
                          <SelectValue placeholder="เลือกหมวด" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CATEGORY_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            <span className="inline-flex items-center gap-1.5">
                              <v.icon className="h-3.5 w-3.5 text-muted-foreground" /> {v.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {extraContent}
            </div>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">รายละเอียด *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="อธิบายไอเดียของคุณ..."
                      className="min-h-[160px] text-sm border-steel-800"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm" variant="forge" className="h-8 text-xs chamfered-sm min-w-24">
                {isSubmitting ? "กำลังสร้าง..." : "สร้างไอเดีย"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}