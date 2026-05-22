import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    sessionOptions: {
        // ปิด refetch ทุกครั้งที่ focus window เพื่อลด request ซ้ำซ้อน
        refetchOnWindowFocus: false,
    },
})