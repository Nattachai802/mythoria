import { NextRequest, NextResponse } from "next/server";
import { cloudDb, DiscordIdea } from "@/lib/neon";
import { createIdea } from "@/server/idea";

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const novelId = searchParams.get("novelId");

        if (!novelId) {
            return NextResponse.json(
                { success: false, error: "novelId is required" },
                { status: 400 }
            );
        }

        // 1. Fetch unsynced ideas from Neon
        const unsyncedIdeas = await cloudDb`
            SELECT * FROM discord_ideas 
            WHERE novel_id = ${novelId} AND is_synced = FALSE
            ORDER BY created_at ASC
        ` as DiscordIdea[];

        if (unsyncedIdeas.length === 0) {
            return NextResponse.json({
                success: true,
                synced: 0,
                message: "No new ideas"
            });
        }

        // 2. Create each idea in local DB
        const syncedIds: string[] = [];
        for (const idea of unsyncedIdeas) {
            const result = await createIdea({
                title: idea.title || "Discord Idea",
                content: idea.content,
                novelId: idea.novel_id,
                category: idea.category || "general",
                tags: [...(idea.tags || []), "discord", "synced"],
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
            console.log(`[Discord Sync API] Marked ${syncedIds.length} ideas as synced`);
        }

        // 4. Cleanup old synced ideas
        await cloudDb`
            DELETE FROM discord_ideas 
            WHERE is_synced = TRUE 
            AND synced_at < NOW() - INTERVAL '7 days'
        `;

        return NextResponse.json({
            success: true,
            synced: syncedIds.length,
            message: `Synced ${syncedIds.length} ideas from Discord`,
        });
    } catch (error) {
        console.error("Discord sync API error:", error);
        return NextResponse.json(
            { success: false, error: "Sync failed" },
            { status: 500 }
        );
    }
}
