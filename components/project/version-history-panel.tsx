"use client"

import { useState, useEffect } from "react"
import { History, RotateCcw, GitCompare, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getNoteVersions, restoreNoteVersion, getVersionsForCompare } from "@/server/version-history"
import { VersionDiffViewer } from "@/components/project/version-diff-viewer"
import { useRouter } from "next/navigation"

interface NoteVersion {
    id: string
    noteId: string
    title: string
    content: any
    wordCount: number | null
    versionNumber: number
    saveType: string
    createdAt: Date
}

interface VersionHistoryPanelProps {
    noteId: string
    novelId: string
    children?: React.ReactNode
}

export function VersionHistoryPanel({ noteId, novelId, children }: VersionHistoryPanelProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [versions, setVersions] = useState<NoteVersion[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedVersions, setSelectedVersions] = useState<string[]>([])
    const [showDiff, setShowDiff] = useState(false)
    const [diffData, setDiffData] = useState<{ v1: NoteVersion, v2: NoteVersion } | null>(null)
    const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null)
    const [restoring, setRestoring] = useState(false)

    // โหลด versions เมื่อเปิด panel
    useEffect(() => {
        if (open) {
            loadVersions()
        }
    }, [open, noteId])

    async function loadVersions() {
        setLoading(true)
        try {
            const result = await getNoteVersions(noteId)
            if (result.success) {
                setVersions(result.versions as NoteVersion[])
            }
        } catch (error) {
            console.error("Failed to load versions:", error)
        } finally {
            setLoading(false)
        }
    }

    function toggleVersionSelect(versionId: string) {
        setSelectedVersions(prev => {
            if (prev.includes(versionId)) {
                return prev.filter(id => id !== versionId)
            }
            if (prev.length >= 2) {
                return [prev[1], versionId]
            }
            return [...prev, versionId]
        })
    }

    async function handleCompare() {
        if (selectedVersions.length !== 2) {
            toast.error("กรุณาเลือก 2 versions เพื่อเปรียบเทียบ")
            return
        }

        const result = await getVersionsForCompare(selectedVersions[0], selectedVersions[1])
        if (result.success && result.version1 && result.version2) {
            // เรียงให้ version เก่าอยู่ซ้าย
            const v1 = result.version1 as NoteVersion
            const v2 = result.version2 as NoteVersion
            if (v1.versionNumber < v2.versionNumber) {
                setDiffData({ v1, v2 })
            } else {
                setDiffData({ v1: v2, v2: v1 })
            }
            setShowDiff(true)
        } else {
            toast.error("ไม่สามารถโหลด versions ได้")
        }
    }

    async function handleRestore(versionId: string) {
        setRestoring(true)
        try {
            const result = await restoreNoteVersion(versionId, novelId)
            if (result.success) {
                toast.success(`กู้คืน version ${result.restoredVersion} สำเร็จ`)
                setRestoreConfirm(null)
                setOpen(false)
                router.refresh()
            } else {
                toast.error(result.error || "ไม่สามารถกู้คืนได้")
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด")
        } finally {
            setRestoring(false)
        }
    }

    function formatDate(date: Date) {
        return new Date(date).toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    {children ? (
                        children
                    ) : (
                        <Button variant="ghost" size="icon" title="Version History">
                            <History className="h-4 w-4" />
                        </Button>
                    )}
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Version History
                        </SheetTitle>
                        <SheetDescription>
                            เก็บ 3 versions ล่าสุด เลือก 2 versions เพื่อเปรียบเทียบ
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-4">
                        {/* Compare button */}
                        {selectedVersions.length === 2 && (
                            <Button onClick={handleCompare} className="w-full">
                                <GitCompare className="h-4 w-4 mr-2" />
                                เปรียบเทียบ {selectedVersions.length} versions
                            </Button>
                        )}

                        {/* Version list */}
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p>ยังไม่มี version history</p>
                                <p className="text-sm">จะบันทึกอัตโนมัติเมื่อ save</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {versions.map((version, index) => (
                                    <div
                                        key={version.id}
                                        className={cn(
                                            "p-3 rounded-lg border cursor-pointer transition-colors",
                                            selectedVersions.includes(version.id)
                                                ? "border-primary bg-primary/5"
                                                : "hover:bg-muted/50"
                                        )}
                                        onClick={() => toggleVersionSelect(version.id)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium">
                                                        Version {version.versionNumber}
                                                    </span>
                                                    <Badge
                                                        variant={version.saveType === 'manual' ? 'default' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {version.saveType === 'manual' ? 'Manual' : 'Auto'}
                                                    </Badge>
                                                    {index === 0 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            ล่าสุด
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {version.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(version.createdAt)}
                                                    {version.wordCount && (
                                                        <span>• {version.wordCount} คำ</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Restore button */}
                                            {index !== 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setRestoreConfirm(version.id)
                                                    }}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Diff Dialog */}
            <Dialog open={showDiff} onOpenChange={setShowDiff}>
                <DialogContent className="max-w-5xl h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>เปรียบเทียบ Versions</DialogTitle>
                    </DialogHeader>
                    {diffData && (
                        <div className="flex-1 overflow-hidden -mx-6 -mb-6">
                            <VersionDiffViewer
                                oldContent={diffData.v1.content}
                                newContent={diffData.v2.content}
                                oldTitle={diffData.v1.title}
                                newTitle={diffData.v2.title}
                                oldVersion={diffData.v1.versionNumber}
                                newVersion={diffData.v2.versionNumber}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Restore Confirm Dialog */}
            <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>กู้คืน Version นี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ระบบจะบันทึก version ปัจจุบันก่อนกู้คืน คุณสามารถย้อนกลับได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => restoreConfirm && handleRestore(restoreConfirm)}
                            disabled={restoring}
                        >
                            {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            กู้คืน
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
