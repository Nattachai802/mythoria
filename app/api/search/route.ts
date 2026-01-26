import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { chapters, notes, characters, locations } from "@/db/schema";
import { ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const searchPattern = `%${query}%`;

    try {
        // Search chapters
        const chapterResults = await db
            .select({
                id: chapters.id,
                title: chapters.title,
                novelId: chapters.novelId,
            })
            .from(chapters)
            .where(ilike(chapters.title, searchPattern))
            .limit(5);

        // Search notes
        const noteResults = await db
            .select({
                id: notes.id,
                title: notes.title,
                novelId: notes.novelId,
            })
            .from(notes)
            .where(ilike(notes.title, searchPattern))
            .limit(5);

        // Search characters
        const characterResults = await db
            .select({
                id: characters.id,
                title: characters.name,
                novelId: characters.novelId,
            })
            .from(characters)
            .where(ilike(characters.name, searchPattern))
            .limit(5);

        // Search locations
        const locationResults = await db
            .select({
                id: locations.id,
                title: locations.name,
                novelId: locations.novelId,
            })
            .from(locations)
            .where(ilike(locations.name, searchPattern))
            .limit(5);

        const results = [
            ...chapterResults.map((r) => ({ ...r, type: "chapter" as const })),
            ...noteResults.map((r) => ({ ...r, type: "note" as const })),
            ...characterResults.map((r) => ({ ...r, type: "character" as const })),
            ...locationResults.map((r) => ({ ...r, type: "location" as const })),
        ];

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Search error:", error);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
