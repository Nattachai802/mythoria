"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// เคสนี้ root layout เองพัง เลยต้องเขียน <html>/<body> เองแบบเปลือย ๆ ใช้ CSS inline
// ไม่พึ่ง globals.css / theme provider เพราะสิ่งที่พังอาจเป็นตัว layout ที่โหลดสิ่งเหล่านั้นเอง
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="th">
            <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0c0a09", color: "#fafaf9" }}>
                <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
                    <div style={{ maxWidth: 420, textAlign: "center" }}>
                        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>แอปเกิดข้อผิดพลาดร้ายแรง</h1>
                        <p style={{ fontSize: 14, color: "#a8a29e", marginBottom: 20 }}>
                            ลองรีเฟรชหน้าเว็บอีกครั้ง ถ้ายังไม่หายให้ติดต่อผู้ดูแลระบบ
                        </p>
                        <button
                            onClick={() => reset()}
                            style={{ padding: "8px 16px", background: "#c2703d", color: "#0c0a09", border: "none", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}
                        >
                            ลองใหม่
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
