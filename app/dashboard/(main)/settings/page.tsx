import { GoogleDriveSettingsCard } from "@/components/project/google-drive-settings-card";
import { TonePresetsCard } from "@/components/dashboard/tone-presets-card";
import { getTonePresets } from "@/server/tone-presets";
import { PageWrapper } from "@/components/page-warpper";

export default async function SettingsPage() {
  const toneResult = await getTonePresets();

  return (
    <PageWrapper breadcrumbs={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "Settings", href: "/dashboard/settings" }]}>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pt-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground">
            จัดการบัญชีผู้ใช้งานและการเชื่อมต่อกับบริการภายนอก
          </p>
        </div>

        <div className="space-y-6 pt-4">
          <GoogleDriveSettingsCard />
          <TonePresetsCard initialPresets={toneResult.data} />
        </div>
      </div>
    </PageWrapper>
  );
}
