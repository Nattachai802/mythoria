import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'doi797vsp', 
    api_key: process.env.CLOUDINARY_API_KEY || '324749169949951', 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

        // Convert file to buffer and upload to Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { 
                    folder: `mythoria/${folder}`,
                    resource_type: "auto"
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(buffer);
        });

        // Get the secure URL from Cloudinary
        const publicUrl = (uploadResult as any).secure_url;

        return NextResponse.json({
            success: true,
            url: publicUrl,
        });
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to upload file to Cloudinary" },
            { status: 500 }
        );
    }
}

// GET method to check endpoint health
export async function GET() {
    return NextResponse.json({
        success: true,
        message: "Cloudinary upload endpoint is ready",
        allowedTypes: ALLOWED_TYPES,
        maxSizeMB: MAX_SIZE / 1024 / 1024,
    });
}
