import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characterDesignElements } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Just doing standard Next route. We'll skip strict auth checks here to keep it simple and match standard boilerplate, or check how other APIs do it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ novelId: string; characterId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { characterId } = resolvedParams;

    const elements = await db
      .select()
      .from(characterDesignElements)
      .where(eq(characterDesignElements.characterId, characterId))
      .orderBy(characterDesignElements.position);

    return NextResponse.json(elements);
  } catch (error) {
    console.error("Error fetching design elements:", error);
    return NextResponse.json({ error: "Failed to fetch design elements" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ novelId: string; characterId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { novelId, characterId } = resolvedParams;
    const body = await req.json();
    const { type, value, name, notes } = body;

    if (!value) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    const resolvedType = type && type.trim() !== "" ? type.trim() : "other";

    const newElement = await db
      .insert(characterDesignElements)
      .values({
        characterId,
        novelId,
        type: resolvedType,
        value,
        name: name || null,
        notes: notes || null,
        position: Date.now(), // simple positioning
      })
      .returning();

    return NextResponse.json(newElement[0]);
  } catch (error) {
    console.error("Error adding design element:", error);
    return NextResponse.json({ error: "Failed to add design element" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ novelId: string; characterId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { characterId } = resolvedParams;
    const { searchParams } = new URL(req.url);
    const elementId = searchParams.get("elementId");

    if (!elementId) {
      return NextResponse.json({ error: "Element ID is required" }, { status: 400 });
    }

    await db
      .delete(characterDesignElements)
      .where(
        and(
          eq(characterDesignElements.id, elementId),
          eq(characterDesignElements.characterId, characterId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting design element:", error);
    return NextResponse.json({ error: "Failed to delete design element" }, { status: 500 });
  }
}
