// จุดเริ่มต้นฝั่งเซิร์ฟเวอร์ — Next.js เรียกไฟล์นี้เองอัตโนมัติตอน server เริ่มทำงาน
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
    if (process.env.NODE_ENV !== "production") return;
    const { captureRequestError } = await import("@sentry/nextjs");
    return captureRequestError(...args);
}
