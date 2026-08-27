"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import type { TonePreset } from "@/db/schema";
import { createTonePreset, updateTonePreset, deleteTonePreset } from "@/server/tone-presets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#374151","#f59e0b","#14b8a6"];

export function TonePresetsCard({ initialPresets }: { initialPresets: TonePreset[] }) {
  const [presets, setPresets] = useState(initialPresets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  const startEdit = (p: TonePreset) => {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditColor(p.color);
  };

  const saveEdit = () => {
    if (!editingId || !editLabel.trim()) return;
    startTransition(async () => {
      const res = await updateTonePreset(editingId, { label: editLabel.trim(), color: editColor });
      if (res.success) {
        setPresets(ps => ps.map(p => p.id === editingId ? { ...p, label: editLabel.trim(), color: editColor } : p));
        setEditingId(null);
      } else {
        toast.error("บันทึกไม่สำเร็จ");
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteTonePreset(id);
      if (res.success) setPresets(ps => ps.filter(p => p.id !== id));
      else toast.error("ลบไม่สำเร็จ");
    });
  };

  const add = () => {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      const res = await createTonePreset(newLabel.trim(), newColor);
      if (res.success && res.data) {
        setPresets(ps => [...ps, res.data!]);
        setNewLabel("");
        setNewColor(PALETTE[0]);
        setShowAdd(false);
      } else {
        toast.error("เพิ่มไม่สำเร็จ");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tone Labels</CardTitle>
        <CardDescription>ป้ายกำกับ tone ฉาก — ใช้แทนแถบสีบนการ์ด Plot Board เพื่อบอกบรรยากาศของแต่ละฉาก</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {presets.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            {editingId === p.id ? (
              <>
                <div className="flex gap-1 flex-wrap">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={cn("w-5 h-5 rounded-full border-2 transition-transform hover:scale-110", editColor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ background: c }} />
                  ))}
                </div>
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="h-7 text-sm flex-1" autoFocus />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveEdit} disabled={pending}>
                  {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 text-sm">{p.label}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-50 hover:opacity-100" onClick={() => startEdit(p)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-50 hover:opacity-100 hover:text-destructive" onClick={() => remove(p.id)} disabled={pending}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {showAdd ? (
          <div className="flex items-center gap-2 pt-1 border-t">
            <div className="flex gap-1 flex-wrap">
              {PALETTE.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={cn("w-5 h-5 rounded-full border-2 transition-transform hover:scale-110", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ชื่อ tone…"
              onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") setShowAdd(false); }}
              className="h-7 text-sm flex-1" autoFocus />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={add} disabled={pending || !newLabel.trim()}>
              {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setShowAdd(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full gap-1 mt-1" onClick={() => setShowAdd(true)}>
            <Plus className="w-3 h-3" /> เพิ่ม tone
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
