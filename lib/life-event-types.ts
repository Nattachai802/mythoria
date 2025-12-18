// Event type configuration for life events
export const EVENT_TYPES = {
    trauma: { label: 'บาดแผล/ความเจ็บปวด', icon: '💔', color: 'bg-red-500' },
    achievement: { label: 'ความสำเร็จ', icon: '🏆', color: 'bg-yellow-500' },
    loss: { label: 'การสูญเสีย', icon: '⚰️', color: 'bg-gray-500' },
    discovery: { label: 'การค้นพบ', icon: '💡', color: 'bg-blue-500' },
    transformation: { label: 'การเปลี่ยนแปลง', icon: '🦋', color: 'bg-purple-500' },
    relationship: { label: 'ความสัมพันธ์', icon: '💕', color: 'bg-pink-500' },
    power: { label: 'พลัง/ความสามารถ', icon: '⚡', color: 'bg-amber-500' },
    other: { label: 'อื่นๆ', icon: '📌', color: 'bg-slate-500' },
} as const;

export type EventType = keyof typeof EVENT_TYPES;
