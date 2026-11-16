import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider"
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider"
import "./globals.css";
import { Toaster } from "sonner";

// ฟอนต์เก็บในโปรเจกต์ (app/fonts) — เดิมใช้ next/font/google ซึ่งต้องโหลดจากเน็ตตอน build แล้วพังบ่อย
const geistSans = localFont({ src: "./fonts/geist-sans.woff2", variable: "--font-geist-sans", weight: "100 900" });
const geistMono = localFont({ src: "./fonts/geist-mono.woff2", variable: "--font-geist-mono", weight: "100 900" });
// Industrial display font for headings (Forge Mode)
const outfit = localFont({ src: "./fonts/outfit.woff2", variable: "--font-outfit", weight: "100 900" });
// Reading font for novel writing canvas
const sarabun = localFont({
  variable: "--font-sarabun",
  // next/font ต้องเป็นค่าตายตัว เขียนวนลูปไม่ได้
  src: [
    { path: "./fonts/sarabun-thai-300.woff2", weight: "300" },
    { path: "./fonts/sarabun-latin-300.woff2", weight: "300" },
    { path: "./fonts/sarabun-thai-400.woff2", weight: "400" },
    { path: "./fonts/sarabun-latin-400.woff2", weight: "400" },
    { path: "./fonts/sarabun-thai-500.woff2", weight: "500" },
    { path: "./fonts/sarabun-latin-500.woff2", weight: "500" },
  ],
});
// Technical monospace for industrial UI elements
const jetbrainsMono = localFont({ src: "./fonts/jetbrains-mono.woff2", variable: "--font-jetbrains", weight: "100 800" });

export const metadata: Metadata = {
  title: "Mythoria",
  description: "Mythoria - Story Architect for Creative Writers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${jetbrainsMono.variable} ${sarabun.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <KeyboardShortcutsProvider>
            {children}
          </KeyboardShortcutsProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
