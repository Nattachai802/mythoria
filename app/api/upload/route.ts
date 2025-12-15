import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Allowed file types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string) || "general";

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { success: false, error: "File too large. Maximum size is 5MB." },
                { status: 400 }
            );
        }

        // Create unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split(".").pop() || "jpg";
        const filename = `${timestamp}-${randomStr}.${extension}`;

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
        await mkdir(uploadDir, { recursive: true });

        // Write file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // Return the public URL
        const publicUrl = `/uploads/${folder}/${filename}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: filename,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to upload file" },
            { status: 500 }
        );
    }
}

// GET method to check endpoint health
export async function GET() {
    return NextResponse.json({
        success: true,
        message: "Upload endpoint is ready",
        allowedTypes: ALLOWED_TYPES,
        maxSizeMB: MAX_SIZE / 1024 / 1024,
    });
}
