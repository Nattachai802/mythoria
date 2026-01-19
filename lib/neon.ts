import { neon } from '@neondatabase/serverless';
export const cloudDb = neon(process.env.NEON_DATABASE_URL!);
export interface DiscordIdea {
    id: string;
    novel_id: string;
    title: string | null;
    content: string;
    category: string;
    tags: string[];
    discord_user_id: string | null;
    discord_username: string | null;
    discord_channel_id: string | null;
    discord_message_id: string | null;
    is_synced: boolean;
    synced_at: Date | null;
    expires_at: Date;
    created_at: Date;
}