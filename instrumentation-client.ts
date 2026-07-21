// รันในเบราว์เซอร์ของ user — จับ error ฝั่ง client (React component พัง, unhandled exception)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // ปิดไว้ตอน dev กันข้อความรก console ระหว่างเขียนโค้ด
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1, // เก็บ performance trace แค่ 10% กัน quota หมดเร็ว (error ยังเก็บ 100% เสมอ)
});

// ให้ Sentry ผูก performance trace เข้ากับการเปลี่ยนหน้า (client-side navigation)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
