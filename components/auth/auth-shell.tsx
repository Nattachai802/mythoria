import { ReactNode } from "react"
import Link from "next/link"

/**
 * โครงหน้าสำหรับทุกหน้าที่เกี่ยวกับบัญชี (login / signup / forgot / reset)
 *
 * แบ่งจอสองฝั่ง: ซ้ายเป็นแผงแบรนด์, ขวาเป็นฟอร์ม จอเล็กกว่า lg จะเหลือฟอร์มอย่างเดียว
 * แผงซ้ายตั้งใจให้มืดคงที่ทั้งธีมสว่างและมืด — เป็นหน้าเดียวในแอปที่ identity นำ
 * เพราะผู้ใช้ยังไม่ได้เข้าสู่งานเขียน (ตาม design principle "Forge Mode is earned, not imposed")
 * เลยใช้ค่าสีตายตัวแทน token ที่พลิกตามธีม ยกเว้น forge-gold/amber ที่ค่าเท่ากันทั้งสองธีมอยู่แล้ว
 */
export function AuthShell({
    title,
    description,
    children,
}: {
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
            {/* แผงแบรนด์ — ซ่อนบนจอเล็ก */}
            <aside
                className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
                style={{ background: "oklch(0.12 0.015 250)", color: "oklch(0.93 0.01 85)" }}
            >
                {/* ตารางเทคนิคจางๆ */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.03) 1px, transparent 1px)",
                        backgroundSize: "32px 32px",
                    }}
                />
                {/* ความร้อนจากเตา — ไล่ขึ้นจากขอบล่างซ้าย เหมือนเหล็กที่โดนเผาจากข้างใต้ */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(70% 55% at 8% 108%, color-mix(in oklch, var(--forge-amber) 42%, transparent), transparent 70%)",
                    }}
                />

                <Link
                    href="/"
                    className="relative font-display text-2xl font-bold tracking-tight rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-gold)]"
                >
                    Mythoria
                </Link>

                <div className="relative max-w-md">
                    <p className="text-pretty text-[1.35rem] font-medium leading-relaxed">
                        เครื่องมือสถาปนิกเรื่องเล่า
                        <br />
                        สำหรับนักเขียนนิยายไทย
                    </p>
                    <p className="mt-4 text-sm leading-relaxed" style={{ color: "oklch(0.72 0.02 250)" }}>
                        วางโครงทั้งเรื่องให้สอดคล้องกันตั้งแต่ตัวละครถึงบทสุดท้าย
                        ไม่ใช่แค่ที่พิมพ์งาน
                    </p>
                </div>

                <ul
                    className="relative flex flex-wrap gap-x-5 gap-y-2 font-technical text-[11px] uppercase tracking-[0.14em]"
                    style={{ color: "oklch(0.62 0.02 250)" }}
                >
                    {["ตัวละคร", "ไทม์ไลน์", "โลกและตำนาน", "พล็อต"].map((item) => (
                        <li key={item} className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="inline-block h-1 w-1 rounded-full"
                                style={{ background: "var(--forge-gold)" }}
                            />
                            {item}
                        </li>
                    ))}
                </ul>
            </aside>

            {/* ฝั่งฟอร์ม — ตามธีมปกติ */}
            <main className="flex flex-col justify-center px-6 py-12 sm:px-10">
                <div className="mx-auto w-full max-w-sm">
                    <Link
                        href="/"
                        className="mb-10 inline-block font-display text-xl font-bold tracking-tight text-[var(--forge-amber)] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
                    >
                        Mythoria
                    </Link>

                    <header className="mb-8">
                        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
                            {title}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground text-pretty">{description}</p>
                    </header>

                    {children}
                </div>
            </main>
        </div>
    )
}
