"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    BookOpen,
    FileText,
    Users,
    MapPin,
    Sparkles,
    Clock,
    LayoutDashboard,
    ScrollText,
    MessageSquareText,
    Globe,
    Zap,
    Share2,
    BarChart3,
    Settings,
    CornerDownLeft,
} from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { useKeyboardShortcutsContext } from "@/components/keyboard-shortcuts-provider";

interface SearchResult {
    id: string;
    title: string;
    type: "chapter" | "note" | "character" | "location";
    novelId: string;
    novelTitle?: string;
}

// Icon mapping
const typeIcons = {
    chapter: BookOpen,
    note: FileText,
    character: Users,
    location: MapPin,
};

const typeLabels = {
    chapter: "บท",
    note: "Note",
    character: "ตัวละคร",
    location: "สถานที่",
};

export function GlobalSearch() {
    const router = useRouter();
    const pathname = usePathname();
    const { isSearchOpen, setSearchOpen } = useKeyboardShortcutsContext();
    const [query, setQuery] = useState("");

    // novelId จาก path ปัจจุบัน (ถ้าอยู่ในโปรเจกต์) → ใช้ทำ navigation commands
    const novelId = useMemo(() => pathname?.match(/\/dashboard\/project\/([^/]+)/)?.[1] ?? null, [pathname]);

    // คำสั่ง "ไปที่" — ไม่ต้องจำว่า feature อยู่ไหน พิมพ์ชื่อแล้วกระโดด
    const navCommands = useMemo(() => {
        if (!novelId) return [] as { label: string; keywords: string; icon: any; href: string }[];
        const base = `/dashboard/project/${novelId}`;
        return [
            { label: "ภาพรวม (Overview)", keywords: "overview ภาพรวม หน้าหลัก", icon: LayoutDashboard, href: base },
            { label: "พล็อต (Plot)", keywords: "plot พล็อต timeline ไทม์ไลน์ ฉาก", icon: ScrollText, href: `${base}/plot` },
            { label: "ไอเดีย (Ideas)", keywords: "idea ไอเดีย canvas", icon: MessageSquareText, href: `${base}/idea` },
            { label: "ตัวละคร (Characters)", keywords: "character ตัวละคร cast", icon: Users, href: `${base}/characters` },
            { label: "สร้างโลก (World Building)", keywords: "world building lore สถานที่ ของวิเศษ ก๊ก", icon: Globe, href: `${base}/worldbuilding` },
            { label: "พลัง (Powers)", keywords: "power พลัง ความสามารถ", icon: Zap, href: `${base}/powers` },
            { label: "World Graph", keywords: "graph กราฟ ความเชื่อมโยง librarian", icon: Share2, href: `${base}/graph` },
            { label: "วิเคราะห์ (Analytics)", keywords: "analytics วิเคราะห์ สถิติ stylometry", icon: BarChart3, href: `${base}/analytics` },
            { label: "ตั้งค่า (Settings)", keywords: "settings ตั้งค่า", icon: Settings, href: `${base}/settings` },
        ];
    }, [novelId]);

    const filteredNav = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return navCommands;
        return navCommands.filter((c) => (c.label + " " + c.keywords).toLowerCase().includes(q));
    }, [navCommands, query]);

    const goTo = (href: string) => {
        router.push(href);
        setSearchOpen(false);
        setQuery("");
    };
    const [results, setResults] = useState<SearchResult[]>([]);
    const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("mythoria-recent-searches");
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse recent searches");
            }
        }
    }, []);

    // Search function
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                setResults(data.results || []);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch(query);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, performSearch]);

    // Handle selection
    const handleSelect = (result: SearchResult) => {
        // Save to recent searches
        const updated = [
            result,
            ...recentSearches.filter((r) => r.id !== result.id),
        ].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem("mythoria-recent-searches", JSON.stringify(updated));

        // Navigate based on type
        let path = "";
        switch (result.type) {
            case "chapter":
                // chapter editor ถูกยุบ → ไปหน้า scene board แทน
                path = `/dashboard/project/${result.novelId}/chapter/${result.id}/overview`;
                break;
            case "note":
                path = `/dashboard/project/${result.novelId}/note/${result.id}`;
                break;
            case "character":
                path = `/dashboard/project/${result.novelId}/characters/${result.id}`;
                break;
            case "location":
                path = `/dashboard/project/${result.novelId}/locations/${result.id}`;
                break;
        }

        router.push(path);
        setSearchOpen(false);
        setQuery("");
    };

    // Group results by type
    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) {
            acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    return (
        <CommandDialog
            open={isSearchOpen}
            onOpenChange={setSearchOpen}
            title="Command Palette"
            description="ค้นหา หรือ ไปที่หน้าใดก็ได้"
            shouldFilter={false}
        >
            <CommandInput
                placeholder="ค้นหา หรือ ไปที่... (ตัวละคร, พล็อต, วิเคราะห์)"
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                            กำลังค้นหา...
                        </div>
                    ) : query ? (
                        "ไม่พบผลลัพธ์"
                    ) : (
                        "พิมพ์เพื่อค้นหา..."
                    )}
                </CommandEmpty>

                {/* Recent Searches */}
                {!query && recentSearches.length > 0 && (
                    <CommandGroup heading="ค้นหาล่าสุด">
                        {recentSearches.map((item) => {
                            const Icon = typeIcons[item.type];
                            return (
                                <CommandItem
                                    key={`recent-${item.id}`}
                                    onSelect={() => handleSelect(item)}
                                    className="flex items-center gap-2"
                                >
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {typeLabels[item.type]}
                                    </span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}

                {/* Navigation commands — ไปที่หน้าใดก็ได้โดยไม่ต้องจำว่าอยู่ตรงไหน */}
                {filteredNav.length > 0 && (
                    <CommandGroup heading="ไปที่">
                        {filteredNav.map((cmd) => (
                            <CommandItem
                                key={cmd.href}
                                value={`nav ${cmd.label} ${cmd.keywords}`}
                                onSelect={() => goTo(cmd.href)}
                                className="flex items-center gap-2"
                            >
                                <cmd.icon className="h-4 w-4 text-muted-foreground" />
                                <span>{cmd.label}</span>
                                <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground/50" />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {/* Search Results */}
                {Object.entries(groupedResults).map(([type, items]) => {
                    const Icon = typeIcons[type as keyof typeof typeIcons];
                    return (
                        <CommandGroup key={type} heading={typeLabels[type as keyof typeof typeLabels]}>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    onSelect={() => handleSelect(item)}
                                    className="flex items-center gap-2"
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                    {item.novelTitle && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {item.novelTitle}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })}
            </CommandList>
        </CommandDialog>
    );
}
