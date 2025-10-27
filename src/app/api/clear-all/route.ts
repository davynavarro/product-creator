import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, BUCKETS } from '@/lib/supabase-storage';

interface ClearResult {
  bucket: string;
  success: boolean;
  deletedCount: number;
  error?: string;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting to clear all Supabase storage...');
    
    const results: ClearResult[] = [];
    const bucketsToClean: string[] = Object.values(BUCKETS);
    
    let totalDeleted = 0;

    for (const bucket of bucketsToClean) {
      try {
        console.log(`Clearing bucket: ${bucket}`);
        
        // List all files in the bucket
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list();

        if (listError) {
          console.error(`Error listing files in ${bucket}:`, listError);
          results.push({
            bucket,
            success: false,
            deletedCount: 0,
            error: listError.message
          });
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`No files found in bucket: ${bucket}`);
          results.push({
            bucket,
            success: true,
            deletedCount: 0
          });
          continue;
        }

        console.log(`Found ${files.length} files in bucket: ${bucket}`);
        
        // Delete all files in the bucket
        const filePaths = files.map(file => file.name);
        const { error: deleteError } = await supabaseAdmin.storage
          .from(bucket)
          .remove(filePaths);

        if (deleteError) {
          console.error(`Error deleting files from ${bucket}:`, deleteError);
          results.push({
            bucket,
            success: false,
            deletedCount: 0,
            error: deleteError.message
          });
          continue;
        }

        console.log(`Successfully deleted ${filePaths.length} files from bucket: ${bucket}`);
        totalDeleted += filePaths.length;
        results.push({
          bucket,
          success: true,
          deletedCount: filePaths.length
        });

      } catch (bucketError) {
        console.error(`Error processing bucket ${bucket}:`, bucketError);
        results.push({
          bucket,
          success: false,
          deletedCount: 0,
          error: bucketError instanceof Error ? bucketError.message : 'Unknown error'
        });
      }
    }

    console.log(`Finished clearing storage. Total files deleted: ${totalDeleted}`);

    return NextResponse.json({
      success: true,
      message: `Successfully cleared ${totalDeleted} files from ${bucketsToClean.length} buckets`,
      totalDeleted,
      results,
      buckets: bucketsToClean
    });

  } catch (error) {
    console.error('Error clearing storage:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear storage',
      totalDeleted: 0,
      results: []
    }, { status: 500 });
  }
}
