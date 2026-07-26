import { auth } from "@/lib/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";

// ด่านตรวจรหัสเชิญย้ายไปอยู่ที่ databaseHooks ใน lib/auth.ts แล้ว
// จุดนั้นครอบทั้งการสมัครด้วยอีเมลและด้วย Google ที่นี่จึงเหลือ handler มาตรฐาน
export const { POST, GET } = toNextJsHandler(auth);
