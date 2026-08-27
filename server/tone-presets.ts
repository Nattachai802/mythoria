'use server';

import { db } from "@/db/drizzle";
import { tonePresets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const DEFAULT_PRESETS = [
  { label: "เผชิญหน้า", color: "#ef4444", sortOrder: 0 },
  { label: "ตึงเครียด", color: "#f97316", sortOrder: 1 },
  { label: "เปิดเผย", color: "#8b5cf6", sortOrder: 2 },
  { label: "เบาสมอง", color: "#eab308", sortOrder: 3 },
  { label: "โศกเศร้า", color: "#3b82f6", sortOrder: 4 },
  { label: "หักมุม", color: "#374151", sortOrder: 5 },
];

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function getTonePresets() {
  try {
    const user = await getUser();
    let rows = await db.select().from(tonePresets).where(eq(tonePresets.userId, user.id)).orderBy(tonePresets.sortOrder);

    // seed defaults on first use
    if (rows.length === 0) {
      await db.insert(tonePresets).values(DEFAULT_PRESETS.map(p => ({ ...p, userId: user.id })));
      rows = await db.select().from(tonePresets).where(eq(tonePresets.userId, user.id)).orderBy(tonePresets.sortOrder);
    }

    return { success: true, data: rows };
  } catch {
    return { success: false, data: [] };
  }
}

export async function createTonePreset(label: string, color: string) {
  try {
    const user = await getUser();
    const existing = await db.select().from(tonePresets).where(eq(tonePresets.userId, user.id));
    const [row] = await db.insert(tonePresets).values({
      userId: user.id,
      label: label.trim(),
      color,
      sortOrder: existing.length,
    }).returning();
    revalidatePath("/dashboard/settings");
    return { success: true, data: row };
  } catch {
    return { success: false };
  }
}

export async function updateTonePreset(id: string, patch: { label?: string; color?: string }) {
  try {
    const user = await getUser();
    await db.update(tonePresets)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(tonePresets.id, id), eq(tonePresets.userId, user.id)));
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function deleteTonePreset(id: string) {
  try {
    const user = await getUser();
    await db.delete(tonePresets).where(and(eq(tonePresets.id, id), eq(tonePresets.userId, user.id)));
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch {
    return { success: false };
  }
}
