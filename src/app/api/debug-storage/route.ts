import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Listing all files in products bucket...');
    
    // List all files in products bucket
    const { data: files, error } = await supabaseAdmin.storage
      .from('products')
      .list();

    if (error) {
      console.error('Error listing files:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Files found:', files);
    
    return NextResponse.json({
      success: true,
      files: files?.map(file => ({
        name: file.name,
        size: file.metadata?.size,
        lastModified: file.updated_at
      })) || []
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to debug storage' },
      { status: 500 }
    );
  }
}