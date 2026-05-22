import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { locationConnections, locations } from "@/db/schema";
import { eq } from "drizzle-orm";

interface Props {
    params: Promise<{ novelId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;

        // Fetch connections and location names in parallel
        const [connections, locationsList] = await Promise.all([
            db
                .select({
                    id: locationConnections.id,
                    sourceLocationId: locationConnections.sourceLocationId,
                    targetLocationId: locationConnections.targetLocationId,
                    connectionType: locationConnections.connectionType,
                    customLabel: locationConnections.customLabel,
                    isBidirectional: locationConnections.isBidirectional,
                    travelTime: locationConnections.travelTime,
                    travelTimeUnit: locationConnections.travelTimeUnit,
                    travelMethod: locationConnections.travelMethod,
                    travelNotes: locationConnections.travelNotes,
                })
                .from(locationConnections)
                .where(eq(locationConnections.novelId, novelId)),
            db
                .select({ id: locations.id, name: locations.name })
                .from(locations)
                .where(eq(locations.novelId, novelId))
        ]);

        const locationMap = new Map(locationsList.map(l => [l.id, l.name]));

        // Enrich connections with location names
        const enrichedConnections = connections.map(conn => ({
            ...conn,
            sourceLocationName: locationMap.get(conn.sourceLocationId) || "Unknown",
            targetLocationName: locationMap.get(conn.targetLocationId) || "Unknown",
        }));

        return NextResponse.json({
            success: true,
            connections: enrichedConnections,
        });
    } catch (error) {
        console.error("Error fetching location connections:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch location connections" },
            { status: 500 }
        );
    }
}
