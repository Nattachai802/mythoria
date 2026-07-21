// รันบนเซิร์ฟเวอร์ (Node runtime) — จับ error จาก server actions, API routes, RSC
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
});
