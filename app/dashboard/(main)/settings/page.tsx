import { GoogleDriveSettingsCard } from "@/components/project/google-drive-settings-card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          จัดการบัญชีผู้ใช้งานและการเชื่อมต่อกับบริการภายนอก
        </p>
      </div>
      
      <div className="space-y-6 pt-4">
        {/* Drive Sync Settings Section */}
        <GoogleDriveSettingsCard />
      </div>
    </div>
  );
}
