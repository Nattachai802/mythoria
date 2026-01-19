'use server';

import { cloudDb, DiscordIdea } from '@/lib/neon';
import { createIdeaWithoutRevalidate } from '@/server/idea';

export async function syncDiscordIdeas(novelId: string) {
    try {
        // 1. Fetch unsynced ideas from Neon
        const unsyncedIdeas = await cloudDb`
            SELECT * FROM discord_ideas 
            WHERE novel_id = ${novelId} AND is_synced = FALSE
            ORDER BY created_at ASC
        ` as DiscordIdea[];
        if (unsyncedIdeas.length === 0) {
            // No new ideas, run cleanup silently
            await cleanupSyncedIdeas();
            return { success: true, synced: 0, message: 'No new ideas' };
        }
        // 2. Create each idea in local DB
        const syncedIds: string[] = [];
        for (const idea of unsyncedIdeas) {
            // Use non-revalidating version to avoid render-time revalidation
            const result = await createIdeaWithoutRevalidate({
                title: idea.title || `Discord Idea`,
                content: idea.content,
                novelId: idea.novel_id,
                category: idea.category || 'general',
                tags: [...(idea.tags || []), 'discord', 'synced'],
            });
            if (result.success) {
                syncedIds.push(idea.id);
            }
        }
        // 3. Mark as synced in Neon (update one by one for reliability)
        if (syncedIds.length > 0) {
            for (const id of syncedIds) {
                await cloudDb`
                    UPDATE discord_ideas 
                    SET is_synced = TRUE, synced_at = NOW()
                    WHERE id = ${id}
                `;
            }
            console.log(`[Discord Sync] Marked ${syncedIds.length} ideas as synced`);
        }
        // 4. Cleanup old synced ideas
        await cleanupSyncedIdeas();
        // Note: revalidation will happen when user navigates to Ideas page
        return {
            success: true,
            synced: syncedIds.length,
            message: `Synced ${syncedIds.length} ideas from Discord`
        };
    } catch (error) {
        console.error('Discord sync error:', error);
        return { success: false, synced: 0, error: 'Sync failed' };
    }
}
/**
 * Get count of unsynced ideas (for badge display)
 */
export async function getUnsyncedCount(novelId: string) {
    try {
        const result = await cloudDb`
            SELECT COUNT(*) as count FROM discord_ideas 
            WHERE novel_id = ${novelId} AND is_synced = FALSE
        `;
        return { success: true, count: Number(result[0]?.count) || 0 };
    } catch (error) {
        console.error('Get unsynced count error:', error);
        return { success: false, count: 0 };
    }
}
/**
 * Cleanup synced ideas older than 7 days
 * Keeps cloud storage small
 */
export async function cleanupSyncedIdeas() {
    try {
        const result = await cloudDb`
            DELETE FROM discord_ideas 
            WHERE is_synced = TRUE 
            AND synced_at < NOW() - INTERVAL '7 days'
            RETURNING id
        `;

        if (result.length > 0) {
            console.log(`[Discord Sync] Cleaned up ${result.length} old synced ideas`);
        }

        return { success: true, deleted: result.length };
    } catch (error) {
        console.error('Cleanup error:', error);
        return { success: false, deleted: 0 };
    }
}
/**
 * Cleanup expired ideas (TTL based)
 */
export async function cleanupExpiredIdeas() {
    try {
        const result = await cloudDb`
            DELETE FROM discord_ideas 
            WHERE expires_at < NOW()
            RETURNING id
        `;

        if (result.length > 0) {
            console.log(`[Discord Sync] Cleaned up ${result.length} expired ideas`);
        }

        return { success: true, deleted: result.length };
    } catch (error) {
        console.error('Cleanup expired error:', error);
        return { success: false, deleted: 0 };
    }
}