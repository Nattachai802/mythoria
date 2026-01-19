"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Cloud, Check } from "lucide-react";
import { toast } from "sonner";

interface DiscordSyncButtonProps {
    novelId: string;
    onSyncComplete?: () => void;
}

export function DiscordSyncButton({ novelId, onSyncComplete }: DiscordSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<number>(0);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(`/api/discord-sync?novelId=${novelId}`, {
                method: "POST",
            });

            const result = await response.json();

            if (result.success) {
                if (result.synced > 0) {
                    toast.success(`Synced ${result.synced} ideas from Discord!`);
                    setLastSynced(result.synced);
                    onSyncComplete?.();
                    // Refresh the page to show new ideas
                    window.location.reload();
                } else {
                    toast.info("No new ideas to sync");
                }
            } else {
                toast.error(result.error || "Sync failed");
            }
        } catch (error) {
            console.error("Sync error:", error);
            toast.error("Failed to sync ideas");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
        >
            {isSyncing ? (
                <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                </>
            ) : lastSynced > 0 ? (
                <>
                    <Check className="w-4 h-4 text-green-500" />
                    Synced {lastSynced}
                </>
            ) : (
                <>
                    <Cloud className="w-4 h-4" />
                    Sync Discord
                </>
            )}
        </Button>
    );
}
