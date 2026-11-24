import { getVault } from "@/server/idea-vault";
import { getNovelByIdSimple } from "@/server/novel";
import { syncDiscordIdeas } from "@/server/discord-sync";
import { VaultView } from "@/components/project/idea/vault-view";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { DiscordSyncButton } from "@/components/project/idea/discord-sync-button";

interface IdeasPageProps {
  params: Promise<{
    id: string;
  }>;
}

// คลังโน้ตไอเดีย — ตาราง ideas เดิมไม่ใช่คลังแล้ว (เหลือเป็นการ์ดฉากย่อยบนกระดานฉาก)
// ปุ่ม "ลบไอเดียทั้งหมด" เดิมเอาออก: deleteAllIdeas ลบการ์ดในฉาก + โน้ตที่ผูกกับการ์ดไปด้วย
export default async function IdeasPage({ params }: IdeasPageProps) {
  const { id: novelId } = await params;

  // Discord sync ก่อนโหลดคลัง — ของใหม่จาก Discord จะได้โผล่ในรอบเดียวกัน
  const syncResult = await syncDiscordIdeas(novelId);
  if (syncResult.synced > 0) {
    console.log(`[Discord sync] Synced ${syncResult.synced} ideas`);
  }
  const [vaultResult, novelResult] = await Promise.all([
    getVault(novelId),
    getNovelByIdSimple(novelId),
  ]);

  if (!vaultResult.success) {
    return (
      <div className="p-8">
        <p className="text-red-500">{vaultResult.error}</p>
      </div>
    );
  }

  const novelTitle = novelResult.novel?.title || "Project";

  return (
    <div className="p-4 md:p-8">
      <ProjectBreadcrumb
        novelId={novelId}
        novelTitle={novelTitle}
        items={[{ label: "คลังไอเดีย" }]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">คลังไอเดีย</h1>
          <p className="mt-1 text-muted-foreground">
            นึกอะไรได้ก็จดไว้ก่อน วางเอกสารยาวเก็บไว้ได้ แล้วติดแท็กว่าจะเอาไปใช้ที่ไหน — ใช้แล้วโน้ตยังอยู่
          </p>
        </div>
        <DiscordSyncButton novelId={novelId} />
      </div>

      <VaultView novelId={novelId} initialNotes={vaultResult.data} />
    </div>
  );
}
