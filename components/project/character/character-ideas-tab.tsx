"use client";

import { EntityIdeasTab } from "@/components/project/shared/entity-ideas-tab";

interface CharacterIdeasTabProps {
    characterId: string;
    characterName: string;
    novelId: string;
    /** @deprecated คลังใหม่โหลดเอง — ไม่ได้ใช้ */
    ideas?: unknown;
}

// ไอเดียของตัวละคร = แท็บไอเดียกลางของ entity (อ่านจากคลังโน้ต)
export function CharacterIdeasTab({ characterId, characterName, novelId }: CharacterIdeasTabProps) {
    return <EntityIdeasTab entityType="character" entityId={characterId} entityName={characterName} novelId={novelId} />;
}
