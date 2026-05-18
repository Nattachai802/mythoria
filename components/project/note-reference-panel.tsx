"use client"

import { useState, useEffect } from "react"
import { getNotes } from "@/server/note"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, BookOpen, Search, X, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NoteReferencePanelProps {
    novelId: string;
    currentNoteId: string;
    linkedChapterId: string | null;
}

export function NoteReferencePanel({ novelId, currentNoteId, linkedChapterId }: NoteReferencePanelProps) {
    const [notes, setNotes] = useState<any[]>([])
    const [openedNoteIds, setOpenedNoteIds] = useState<string[]>([])
    const [activeTabId, setActiveTabId] = useState<string>("")
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [showSearch, setShowSearch] = useState(false)

    useEffect(() => {
        const fetchNotes = async () => {
            setLoading(true)
            try {
                const result = await getNotes(novelId)
                if (result.success && result.notes) {
                    setNotes(result.notes)
                    
                    // หา default note: ตอนก่อนหน้าของ chapter ปัจจุบัน ถ้ามี
                    let defaultId = ""
                    if (linkedChapterId) {
                        const currentNoteIndex = result.notes.findIndex(n => n.id === currentNoteId)
                        if (currentNoteIndex >= 0) {
                            // notes เรียงตาม createdAt desc (ใหม่ไปเก่า)
                            // ตอนก่อนหน้า จะอยู่ index ที่มากกว่า
                            const prevNote = result.notes.find((n, i) => i > currentNoteIndex && n.linkedToChapterId === linkedChapterId)
                            if (prevNote) {
                                defaultId = prevNote.id
                            }
                        }
                    }
                    
                    // ถ้าหาใน chapter ไม่เจอ ให้เอาตอนล่าสุดที่แก้ไขที่ไม่ใช่ตอนปัจจุบัน
                    if (!defaultId) {
                        const otherNote = result.notes.find(n => n.id !== currentNoteId)
                        if (otherNote) {
                            defaultId = otherNote.id
                        }
                    }
                    
                    if (defaultId) {
                        setOpenedNoteIds([defaultId])
                        setActiveTabId(defaultId)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch reference notes", error)
            } finally {
                setLoading(false)
            }
        }
        
        fetchNotes()
    }, [novelId, currentNoteId, linkedChapterId])

    const handleAddTab = (id: string) => {
        if (!openedNoteIds.includes(id)) {
            setOpenedNoteIds([...openedNoteIds, id])
        }
        setActiveTabId(id)
    }

    const handleCloseTab = (id: string) => {
        const newIds = openedNoteIds.filter(nId => nId !== id)
        setOpenedNoteIds(newIds)
        if (activeTabId === id) {
            setActiveTabId(newIds.length > 0 ? newIds[newIds.length - 1] : "")
        }
    }

    const selectedNote = notes.find(n => n.id === activeTabId)

    const getHighlightedContent = () => {
        if (!selectedNote?.content?.text) return "<p class='text-muted-foreground italic'>ไม่มีเนื้อหา</p>"
        
        const rawContent = selectedNote.content.text;
        if (!searchQuery.trim()) return rawContent;

        // Escape RegExp special characters
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedQuery = escapeRegExp(searchQuery.trim());
        
        // Match text that is NOT inside an HTML tag
        // (?![^<]*>) ensures we don't match our query if it's inside <... >
        const regex = new RegExp(`(?![^<]*>)(${escapedQuery})`, 'gi');
        
        return rawContent.replace(regex, '<mark class="bg-yellow-300/80 dark:bg-yellow-500/50 text-inherit rounded-sm px-0.5">$1</mark>');
    }

    return (
        <div className="flex flex-col h-full bg-background border-r">
            {/* Tabs Row */}
            <div className="flex items-center w-full border-b bg-muted/10 shrink-0">
                <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
                    {openedNoteIds.map(id => {
                        const note = notes.find(n => n.id === id)
                        if (!note) return null
                        const isActive = activeTabId === id
                        return (
                            <div 
                                key={id}
                                onClick={() => setActiveTabId(id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer border-r whitespace-nowrap min-w-[100px] max-w-[200px] transition-colors group",
                                    isActive ? "bg-background border-b-2 border-b-primary text-foreground" : "text-muted-foreground hover:bg-muted/50 border-b-2 border-b-transparent"
                                )}
                            >
                                <BookOpen className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                                <span className="truncate flex-1">{note.title || "Untitled Note"}</span>
                                <button 
                                    className="p-0.5 hover:bg-muted-foreground/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleCloseTab(id)
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        )
                    })}
                </div>
                
                <div className="flex items-center shrink-0 border-l bg-muted/10 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)]">
                    <button 
                        onClick={() => {
                            setShowSearch(!showSearch)
                            if (showSearch) setSearchQuery("")
                        }}
                        className={cn(
                            "flex items-center justify-center px-3 py-2 transition-colors border-b-2",
                            showSearch ? "text-primary border-b-primary bg-muted/30" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-transparent"
                        )}
                        title="ค้นหาในหน้านี้"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center justify-center px-3 py-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors border-b-2 border-b-transparent">
                                <Plus className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuLabel className="text-xs">เพิ่มตอนอ้างอิง</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                                {notes.filter(n => n.id !== currentNoteId && !openedNoteIds.includes(n.id)).map(note => (
                                    <DropdownMenuItem 
                                        key={note.id}
                                        onSelect={() => handleAddTab(note.id)}
                                    >
                                        <BookOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                        <span className="truncate">{note.title || "Untitled"}</span>
                                    </DropdownMenuItem>
                                ))}
                                {notes.filter(n => n.id !== currentNoteId && !openedNoteIds.includes(n.id)).length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">ไม่มีตอนอื่นให้เลือกแล้ว</div>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="p-2 border-b flex flex-col gap-2 bg-muted/5 shrink-0">
                    {openedNoteIds.length > 0 ? (
                        <div className="relative px-2 pb-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                placeholder="ค้นหาข้อความในหน้านี้..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 text-xs pl-8 bg-background"
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground text-center py-1">กรุณาเพิ่มตอนอ้างอิงจากเครื่องหมาย +</div>
                    )}
                </div>
            )}
            <div className="flex-1 overflow-hidden relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : selectedNote ? (
                    <ScrollArea className="h-full">
                        <div 
                            className="p-6 text-base leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2"
                            dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
                        />
                    </ScrollArea>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                        ไม่พบตอนอื่นเพื่อใช้อ้างอิง
                    </div>
                )}
            </div>
        </div>
    )
}
