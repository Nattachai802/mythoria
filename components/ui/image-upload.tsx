"use client";

import { useState, useRef, ReactNode } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    value?: string;
    onChange?: (url: string) => void;
    folder?: string;
    className?: string;
    /** If provided, renders only the trigger element (for compact UI) */
    trigger?: ReactNode;
}

export function ImageUpload({ value, onChange, folder = "characters", className, trigger }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        setError(null);
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", folder);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                onChange?.(result.url);
            } else {
                setError(result.error || "Upload failed");
            }
        } catch (err) {
            setError("Failed to upload image");
            console.error("Upload error:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUpload(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            handleUpload(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleRemove = () => {
        onChange?.("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    // Hidden file input (shared by both modes)
    const hiddenInput = (
        <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
        />
    );

    // Compact trigger mode - just render the trigger that opens file picker
    if (trigger) {
        return (
            <>
                {hiddenInput}
                <div
                    onClick={() => inputRef.current?.click()}
                    className={cn("cursor-pointer", isUploading && "opacity-50 pointer-events-none")}
                >
                    {isUploading ? (
                        <div className="flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : (
                        trigger
                    )}
                </div>
            </>
        );
    }

    // Full mode - original UI
    return (
        <div className={cn("space-y-2", className)}>
            {/* Preview or Upload Area */}
            {value ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-muted">
                    <img
                        src={value}
                        alt="Preview"
                        className="w-full h-full object-cover"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => inputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
                        isDragging
                            ? "border-primary bg-primary/10"
                            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    )}
                >
                    {isUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                        <>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground text-center px-2">
                                Click or drag
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Hidden file input */}
            {hiddenInput}

            {/* URL Input (optional fallback) */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder="or paste image URL"
                    value={value || ""}
                    onChange={(e) => onChange?.(e.target.value)}
                    className="text-xs h-8"
                />
            </div>

            {/* Error message */}
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}

