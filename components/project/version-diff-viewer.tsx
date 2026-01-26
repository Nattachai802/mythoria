"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface DiffLine {
    type: 'added' | 'removed' | 'unchanged'
    content: string
    lineNumber: number | null
}

interface VersionDiffViewerProps {
    oldContent: string
    newContent: string
    oldTitle: string
    newTitle: string
    oldVersion: number
    newVersion: number
}

/**
 * แปลง HTML content เป็น plain text lines
 */
function htmlToLines(html: string): string[] {
    if (!html) return []

    // แปลง HTML เป็น text
    const text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')

    return text.split('\n').filter(line => line.trim() !== '')
}

/**
 * Simple diff algorithm (LCS-based)
 */
function computeDiff(oldLines: string[], newLines: string[]): {
    left: DiffLine[],
    right: DiffLine[]
} {
    const left: DiffLine[] = []
    const right: DiffLine[] = []

    let oldIdx = 0
    let newIdx = 0
    let oldLineNum = 1
    let newLineNum = 1

    // Simple line-by-line comparison
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
        if (oldIdx >= oldLines.length) {
            // เหลือแต่บรรทัดใหม่
            left.push({ type: 'unchanged', content: '', lineNumber: null })
            right.push({ type: 'added', content: newLines[newIdx], lineNumber: newLineNum++ })
            newIdx++
        } else if (newIdx >= newLines.length) {
            // เหลือแต่บรรทัดเก่า
            left.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: oldLineNum++ })
            right.push({ type: 'unchanged', content: '', lineNumber: null })
            oldIdx++
        } else if (oldLines[oldIdx] === newLines[newIdx]) {
            // บรรทัดเหมือนกัน
            left.push({ type: 'unchanged', content: oldLines[oldIdx], lineNumber: oldLineNum++ })
            right.push({ type: 'unchanged', content: newLines[newIdx], lineNumber: newLineNum++ })
            oldIdx++
            newIdx++
        } else {
            // หาว่าบรรทัดเก่าถูกลบหรือบรรทัดใหม่ถูกเพิ่ม
            const oldInNew = newLines.indexOf(oldLines[oldIdx], newIdx)
            const newInOld = oldLines.indexOf(newLines[newIdx], oldIdx)

            if (oldInNew === -1 && newInOld === -1) {
                // ทั้งคู่เปลี่ยน
                left.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: oldLineNum++ })
                right.push({ type: 'added', content: newLines[newIdx], lineNumber: newLineNum++ })
                oldIdx++
                newIdx++
            } else if (oldInNew === -1 || (newInOld !== -1 && newInOld < oldInNew)) {
                // บรรทัดเก่าถูกลบ
                left.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: oldLineNum++ })
                right.push({ type: 'unchanged', content: '', lineNumber: null })
                oldIdx++
            } else {
                // บรรทัดใหม่ถูกเพิ่ม
                left.push({ type: 'unchanged', content: '', lineNumber: null })
                right.push({ type: 'added', content: newLines[newIdx], lineNumber: newLineNum++ })
                newIdx++
            }
        }
    }

    return { left, right }
}

export function VersionDiffViewer({
    oldContent,
    newContent,
    oldTitle,
    newTitle,
    oldVersion,
    newVersion,
}: VersionDiffViewerProps) {
    const diff = useMemo(() => {
        const oldText = typeof oldContent === 'object' ? (oldContent as any)?.text || '' : oldContent
        const newText = typeof newContent === 'object' ? (newContent as any)?.text || '' : newContent

        const oldLines = htmlToLines(oldText)
        const newLines = htmlToLines(newText)

        return computeDiff(oldLines, newLines)
    }, [oldContent, newContent])

    const stats = useMemo(() => {
        const added = diff.right.filter(l => l.type === 'added').length
        const removed = diff.left.filter(l => l.type === 'removed').length
        return { added, removed }
    }, [diff])

    return (
        <div className="flex flex-col h-full">
            {/* Header with stats */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 dark:text-green-400">
                        +{stats.added} เพิ่ม
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                        -{stats.removed} ลบ
                    </span>
                </div>
            </div>

            {/* Side-by-side diff */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-2 min-w-[600px]">
                    {/* Left side (old) */}
                    <div className="border-r">
                        <div className="sticky top-0 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 border-b text-sm font-medium">
                            Version {oldVersion}: {oldTitle}
                        </div>
                        <div className="font-mono text-sm">
                            {diff.left.map((line, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex min-h-[24px]",
                                        line.type === 'removed' && "bg-red-100 dark:bg-red-950/50",
                                    )}
                                >
                                    <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-muted-foreground/50 border-r select-none">
                                        {line.lineNumber || ''}
                                    </span>
                                    <span className={cn(
                                        "flex-1 px-2 py-0.5 whitespace-pre-wrap break-words",
                                        line.type === 'removed' && "text-red-700 dark:text-red-300"
                                    )}>
                                        {line.type === 'removed' && <span className="select-none mr-1">-</span>}
                                        {line.content}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right side (new) */}
                    <div>
                        <div className="sticky top-0 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 border-b text-sm font-medium">
                            Version {newVersion}: {newTitle}
                        </div>
                        <div className="font-mono text-sm">
                            {diff.right.map((line, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex min-h-[24px]",
                                        line.type === 'added' && "bg-green-100 dark:bg-green-950/50",
                                    )}
                                >
                                    <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-muted-foreground/50 border-r select-none">
                                        {line.lineNumber || ''}
                                    </span>
                                    <span className={cn(
                                        "flex-1 px-2 py-0.5 whitespace-pre-wrap break-words",
                                        line.type === 'added' && "text-green-700 dark:text-green-300"
                                    )}>
                                        {line.type === 'added' && <span className="select-none mr-1">+</span>}
                                        {line.content}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
