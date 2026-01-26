// Cache tags for revalidation - shared across server actions
// ใช้สำหรับ invalidate cache เมื่อมีการแก้ไขข้อมูล

export const CACHE_TAGS = {
    novel: (id: string) => `novel-${id}`,
    novelList: (userId: string) => `novels-${userId}`,
    chapters: (novelId: string) => `chapters-${novelId}`,
    characters: (novelId: string) => `characters-${novelId}`,
    locations: (novelId: string) => `locations-${novelId}`,
    ideas: (novelId: string) => `ideas-${novelId}`,
    notes: (novelId: string) => `notes-${novelId}`,
    analytics: (novelId: string) => `analytics-${novelId}`,
} as const;

// Cache durations in seconds
export const CACHE_DURATION = {
    short: 30,    // Notes - change frequently
    medium: 60,   // Novel, chapters, characters
    long: 300,    // Rarely changing data
} as const;
