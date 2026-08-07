"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerRule } from "@/db/schema";
import { createPowerRule, updatePowerRule, deletePowerRule, importLimitationsAsRules } from "@/server/power-rule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Scale, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KINDS = {
    cost: { label: "ราคาที่ต้องจ่าย", hint: "ใช้แล้วเสียอะไรไป" },
    limit: { label: "ข้อจำกัด", hint: "ทำได้แค่ไหน" },
    forbidden: { label: "ข้อห้าม", hint: "ทำไม่ได้เด็ดขาด" },
    condition: { label: "เงื่อนไข", hint: "ต้องมีอะไรก่อนถึงใช้ได้" },
} as const;

const SEVERITIES = {
    hard: { label: "ตายตัว", hint: "ฝ่าฝืนไม่ได้ ถ้าฝ่าคือพล็อตโฮล" },
    soft: { label: "ยืดหยุ่น", hint: "ฝ่าได้ แต่ต้องมีราคาในเรื่อง" },
} as const;

type Kind = keyof typeof KINDS;
type Severity = keyof typeof SEVERITIES;

const kindStyle: Record<Kind, string> = {
    cost: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25",
    limit: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25",
    forbidden: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/25",
    condition: "bg-violet-500/12 text-violet-700 dark:text-violet-400 border-violet-500/25",
};

const asKind = (v: string | null): Kind => (v && v in KINDS ? (v as Kind) : "limit");
const asSeverity = (v: string | null): Severity => (v === "soft" ? "soft" : "hard");

interface Props {
    novelId: string;
    rules: PowerRule[];
    powers: Power[];
    /** มีข้อจำกัดเดิมค้างอยู่ใน powers.limitations ไหม — ใช้ตัดสินว่าจะโชว์ปุ่มดึงเข้ามา */
    hasLegacyLimitations: boolean;
}

export function PowerRulesPanel({ novelId, rules, powers, hasLegacyLimitations }: Props) {
    const [editing, setEditing] = useState<PowerRule | null>(null);
    const [creating, setCreating] = useState(false);
    const [importing, startImport] = useTransition();
    const router = useRouter();

    const runImport = () =>
        startImport(async () => {
            const res = await importLimitationsAsRules(novelId);
            if (!res.success) { toast.error("ดึงข้อจำกัดเดิมไม่สำเร็จ"); return; }
            toast.success(res.imported ? `ดึงมาเป็นกฎแล้ว ${res.imported} ข้อ` : "ไม่มีข้อจำกัดใหม่ให้ดึง");
            router.refresh();
        });

    return (
        <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                        <Scale className="w-4 h-4 text-[var(--forge-gold)]" />
                        กฎของระบบพลัง
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        กติกาที่ทุกพลังต้องเคารพ — กฎที่ไม่ผูกพลังไหนเลยจะใช้กับทั้งเรื่อง
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasLegacyLimitations && (
                        <Button variant="outline" size="sm" onClick={runImport} disabled={importing}>
                            <Download className="w-4 h-4" />
                            {importing ? "กำลังดึง…" : "ดึงข้อจำกัดเดิมมาเป็นกฎ"}
                        </Button>
                    )}
                    <Dialog open={creating} onOpenChange={setCreating}>
                        <DialogTrigger asChild>
                            <Button size="sm"><Plus className="w-4 h-4" />เพิ่มกฎ</Button>
                        </DialogTrigger>
                        <RuleDialog novelId={novelId} powers={powers} onDone={() => setCreating(false)} />
                    </Dialog>
                </div>
            </div>

            {rules.length === 0 ? (
                <div className="chamfered border border-dashed border-border bg-card/40 px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        ยังไม่มีกฎ — เช่น &ldquo;ใช้เวทต้องแลกด้วยอายุขัย&rdquo; หรือ &ldquo;ห้ามชุบชีวิตคนตาย&rdquo;
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {rules.map((rule) => {
                        const kind = asKind(rule.kind);
                        const severity = asSeverity(rule.severity);
                        const scope = ((rule.powerIds as string[] | null) ?? [])
                            .map((id) => powers.find((p) => p.id === id)?.name)
                            .filter(Boolean) as string[];
                        return (
                            <li key={rule.id} className="chamfered border border-border bg-card/60 px-4 py-3 flex items-start gap-3">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", kindStyle[kind])}>
                                            {KINDS[kind].label}
                                        </span>
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                                            title={SEVERITIES[severity].hint}
                                        >
                                            {SEVERITIES[severity].label}
                                        </span>
                                        <span className="font-medium">{rule.title}</span>
                                    </div>
                                    {rule.description && (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground/80">
                                        {scope.length ? `ใช้กับ: ${scope.join(", ")}` : "ใช้กับทุกพลังในเรื่อง"}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Dialog open={editing?.id === rule.id} onOpenChange={(o) => setEditing(o ? rule : null)}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="แก้ไขกฎ">
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <RuleDialog novelId={novelId} powers={powers} rule={rule} onDone={() => setEditing(null)} />
                                    </Dialog>
                                    <DeleteRuleButton novelId={novelId} rule={rule} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function DeleteRuleButton({ novelId, rule }: { novelId: string; rule: PowerRule }) {
    const [pending, start] = useTransition();
    const router = useRouter();
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-destructive hover:text-destructive">
                    ลบ
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>ลบกฎนี้?</AlertDialogTitle>
                    <AlertDialogDescription>&ldquo;{rule.title}&rdquo; จะหายไปถาวร</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={pending}
                        onClick={() =>
                            start(async () => {
                                const res = await deletePowerRule(rule.id, novelId);
                                if (!res.success) { toast.error("ลบไม่สำเร็จ"); return; }
                                toast.success("ลบกฎแล้ว");
                                router.refresh();
                            })
                        }
                    >
                        ลบ
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function RuleDialog({
    novelId,
    powers,
    rule,
    onDone,
}: {
    novelId: string;
    powers: Power[];
    rule?: PowerRule;
    onDone: () => void;
}) {
    const [title, setTitle] = useState(rule?.title ?? "");
    const [description, setDescription] = useState(rule?.description ?? "");
    const [kind, setKind] = useState<Kind>(asKind(rule?.kind ?? null));
    const [severity, setSeverity] = useState<Severity>(asSeverity(rule?.severity ?? null));
    const [powerIds, setPowerIds] = useState<string[]>(((rule?.powerIds as string[] | null) ?? []));
    const [pending, start] = useTransition();
    const router = useRouter();

    const toggle = (id: string) =>
        setPowerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const submit = () =>
        start(async () => {
            const payload = { title, description, kind, severity, powerIds };
            const res = rule
                ? await updatePowerRule(rule.id, novelId, payload)
                : await createPowerRule(novelId, payload);
            if (!res.success) { toast.error(res.error ?? "บันทึกไม่สำเร็จ"); return; }
            toast.success(rule ? "แก้ไขกฎแล้ว" : "เพิ่มกฎแล้ว");
            router.refresh();
            onDone();
        });

    return (
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{rule ? "แก้ไขกฎ" : "เพิ่มกฎของระบบพลัง"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">ตัวกฎ</label>
                    <Input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="เช่น ใช้เวทต้องแลกด้วยอายุขัย"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">ประเภท</label>
                        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(KINDS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label} — {v.hint}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">ความเข้มงวด</label>
                        <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(SEVERITIES).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label} — {v.hint}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">รายละเอียด / ข้อยกเว้น</label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="ขยายความว่ากฎนี้ทำงานยังไง มีข้อยกเว้นไหม"
                        className="min-h-[72px] max-h-64 field-sizing-content resize-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">ใช้กับพลัง</label>
                    <p className="text-xs text-muted-foreground">ไม่เลือกเลย = ใช้กับทุกพลังในเรื่อง</p>
                    {powers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">ยังไม่มีพลังในเรื่องนี้</p>
                    ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                            {powers.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                                    <Checkbox checked={powerIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                                    <span className="truncate">{p.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <DialogFooter>
                <Button variant="ghost" onClick={onDone}>ยกเลิก</Button>
                <Button onClick={submit} disabled={pending || !title.trim()}>
                    {pending ? "กำลังบันทึก…" : rule ? "บันทึก" : "เพิ่มกฎ"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}
