import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToBlob } from '@/lib/blob-storage';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('image') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Upload to Vercel Blob
    const imageUrl = await uploadImageToBlob(file);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: imageUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}