import { notFound } from "next/navigation";
import { getNovelByIdSimple } from "@/server/novel";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { GoogleDriveSettingsCard } from "@/components/project/google-drive-settings-card";
import { WritingGoalsSettingsCard } from "@/components/project/writing-goals-settings-card";

export default async function ProjectSettingsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  const result = await getNovelByIdSimple(id);
  
  if (!result.success || !result.novel) {
    notFound();
  }

  const novel = result.novel;
  
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <ProjectBreadcrumb
        novelId={id}
        novelTitle={novel.title}
        items={[{ label: "Settings" }]}
      />
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground">
          จัดการการตั้งค่าต่างๆ ของนิยายเรื่องนี้ รวมถึงการซิงค์ข้อมูลภายนอก
        </p>
      </div>
      
      <div className="space-y-6 pt-4">
        {/* Writing Goals & Deadline Section */}
        <WritingGoalsSettingsCard
          novelId={id}
          initialTargetWordCount={(novel as any).targetWordCount ?? null}
          initialTargetDeadline={(novel as any).targetDeadline ?? null}
          initialDailyTargetMode={(novel as any).dailyTargetMode ?? "dynamic"}
          initialDailyTargetWordCount={(novel as any).dailyTargetWordCount ?? 1000}
        />

        {/* Drive Sync Settings Section */}
        <GoogleDriveSettingsCard />
      </div>
    </div>
  );
}

