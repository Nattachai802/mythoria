import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** รวมเข้าหน้า "ตัวละครและฝ่าย" แล้ว — คงไว้ให้ลิงก์เดิมยังใช้ได้ */
export default async function FactionsPage({ params }: Props) {
    const { id } = await params;
    redirect(`/dashboard/project/${id}/characters?view=factions`);
}
