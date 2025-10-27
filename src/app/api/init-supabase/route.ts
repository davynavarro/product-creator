import { NextResponse } from 'next/server';
import { initializeSupabaseBuckets } from '../../../lib/supabase-storage';

export async function POST() {
  try {
    console.log('Initializing Supabase storage buckets...');
    await initializeSupabaseBuckets();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Supabase storage buckets initialized successfully' 
    });
  } catch (error) {
    console.error('Failed to initialize Supabase buckets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize storage buckets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}