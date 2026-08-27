import { listTrash, purgeExpiredTrash } from "@/server/trash";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { TrashList } from "@/components/project/trash-list";
import { PageWrapper } from "@/components/page-warpper";

// หน้านี้ผูกกับ session เสมอ — บอก Next ตรง ๆ ไม่ต้องลอง prerender (ไม่งั้น listTrash จะกลืน
// DynamicServerError ของ Next ไว้ใน catch แล้วขึ้น log error กวนตอน build)
export const dynamic = "force-dynamic";

export default async function TrashPage() {
    // ล้างของหมดอายุตอนเปิดหน้า — ที่เดียวที่การันตีว่ามีคนรัน (ยังไม่มี cron)
    await purgeExpiredTrash().catch(() => { });
    const result = await listTrash();

    return (
        <PageWrapper breadcrumbs={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "ถังขยะ", href: "/dashboard/trash" }]}>
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pt-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">ถังขยะ</h1>
                    <p className="text-muted-foreground">
                        ของที่ลบจะอยู่ที่นี่ {TRASH_RETENTION_DAYS} วัน กู้คืนได้ตลอดช่วงนั้น หลังจากนั้นระบบจะล้างถาวร
                    </p>
                </div>

                {result.success
                    ? <TrashList items={result.items ?? []} />
                    : <p className="text-sm text-destructive">{result.message}</p>}
            </div>
        </PageWrapper>
    );
}
