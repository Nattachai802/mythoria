"use client";

/**
 * แท็บ "ไอเดีย" ในหน้าตัวละคร / สถานที่ / พลัง / lore / ฝ่าย — อ่านจากคลังโน้ต (idea_vault + idea_vault_links)
 * - ผูกกับตัวนี้แล้ว (relation about)
 * - ติดแท็กชนิดนี้แต่ยังไม่ผูกกับตัวไหน → กดผูกได้
 * - จดใหม่จากตรงนี้ = ผูกให้อัตโนมัติ
 * โหลดเองตอนเปิด (prop ideas เดิมไม่ได้ใช้แล้ว — คงไว้ให้ caller เดิมคอมไพล์ผ่าน)
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, Lightbulb, Link2, Loader2, Unlink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SCOPE_OF_TARGET, type VaultLinkTarget } from "@/lib/idea-scopes";
import {
    addVaultLink, createVaultNote, getVaultNotesForTarget, removeVaultLink, type VaultNoteView,
} from "@/server/idea-vault";
import { ScopeTags, effectiveScopes, isUsedNote } from "@/components/project/idea/vault-ui";

interface EntityIdeasTabProps {
    entityType: Exclude<VaultLinkTarget, "timelineEvent">;
    entityId: string;
    entityName: string;
    novelId: string;
    /** @deprecated คลังใหม่โหลดเอง — ไม่ได้ใช้ */
    ideas?: unknown;
}

export function EntityIdeasTab({ entityType, entityId, entityName, novelId }: EntityIdeasTabProps) {
    const [linked, setLinked] = useState<VaultNoteView[] | null>(null);
    const [suggested, setSuggested] = useState<VaultNoteView[]>([]);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const res = await getVaultNotesForTarget(novelId, entityType, entityId);
        if (!res.success) { toast.error(res.error); setLinked([]); return; }
        setLinked(res.data.linked);
        setSuggested(res.data.suggested);
    }, [novelId, entityType, entityId]);

    useEffect(() => { load(); }, [load]);

    const add = async () => {
        const text = draft.trim();
        if (!text || saving) return;
        setSaving(true);
        const scope = SCOPE_OF_TARGET[entityType];
        const res = await createVaultNote({
            novelId, text, scopes: scope ? [scope] : [],
            links: [{ targetType: entityType, targetId: entityId }],
        });
        setSaving(false);
        if (!res.success) { toast.error(res.error); return; }
        if (res.isDuplicate) {
            // โน้ตเดิมข้อความเดียวกัน — ผูกให้แทนการสร้างซ้ำ
            await addVaultLink(res.data.id, entityType, entityId);
            toast.info("มีโน้ตนี้อยู่แล้ว ผูกให้แล้ว");
        }
        setDraft("");
        load();
    };

    const link = async (n: VaultNoteView) => {
        const res = await addVaultLink(n.id, entityType, entityId);
        if (!res.success) { toast.error(res.error); return; }
        load();
    };
    const unlink = async (n: VaultNoteView) => {
        const res = await removeVaultLink(n.id, entityType, entityId);
        if (!res.success) { toast.error(res.error); return; }
        load();
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                    placeholder={`จดไอเดียเกี่ยวกับ${entityName}`}
                    aria-label={`จดไอเดียเกี่ยวกับ${entityName}`}
                    disabled={saving}
                />
                <Button onClick={add} disabled={saving || !draft.trim()} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}จด
                </Button>
            </div>

            <section className="space-y-2">
                <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs text-muted-foreground">ผูกกับ{entityName}แล้ว · {linked?.length ?? 0}</p>
                    <a href={`/dashboard/project/${novelId}/idea`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">เปิดคลังไอเดีย</a>
                </div>
                {linked === null ? (
                    <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>
                ) : linked.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-8 text-center">
                        <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
                        <p className="mt-2 text-sm">ยังไม่มีไอเดียเกี่ยวกับ{entityName}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">จดด้านบน หรือผูกโน้ตจากคลัง</p>
                    </div>
                ) : (
                    <ul className="overflow-hidden rounded-lg border">
                        {linked.map(n => (
                            <li key={n.id} className="flex items-start gap-2 border-b px-3 py-2.5 last:border-b-0">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-relaxed">{n.text}</p>
                                    {n.summary && <p className="line-clamp-2 text-[13px] text-muted-foreground">{n.summary}</p>}
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                        <ScopeTags scopes={effectiveScopes(n)} />
                                        {isUsedNote(n) && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CircleCheck className="h-3.5 w-3.5" />ใช้แล้ว</span>}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => unlink(n)} aria-label={`ถอด “${n.text}” ออกจาก${entityName}`}>
                                    <Unlink className="h-3.5 w-3.5" />ถอด
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {suggested.length > 0 && (
                <section className="space-y-2">
                    <p className="text-xs text-muted-foreground">ติดแท็กนี้แต่ยังไม่ผูกกับใคร · {suggested.length}</p>
                    <ul className="overflow-hidden rounded-lg border">
                        {suggested.map(n => (
                            <li key={n.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                                <p className="min-w-0 flex-1 text-sm">{n.text}</p>
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => link(n)}>
                                    <Link2 className="h-3.5 w-3.5" />ผูกกับ{entityName}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
