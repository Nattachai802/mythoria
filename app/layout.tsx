import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, JetBrains_Mono, Sarabun } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider"
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider"
import "./globals.css";
import { Toaster } from "sonner";

// Primary body font - clean and modern
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Monospace for code/technical elements
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Industrial display font for headings (Forge Mode)
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Reading font for novel writing canvas
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500"],
});

// Technical monospace for industrial UI elements
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
