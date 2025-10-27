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
    const bucketsToClean: string[] = Object.values(BUCKETS); // ['products', 'images', 'cart', 'categories', 'orders']
    
    let totalDeleted = 0;

    for (const bucket of bucketsToClean) {
      try {
        console.log(`Clearing bucket: ${bucket}`);
        
        // List all files in the bucket
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

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

        // Get file paths for deletion
        const filePaths = files.map((file: { name: string }) => file.name);
        console.log(`Deleting ${filePaths.length} files from ${bucket}:`, filePaths);

        // Delete all files in batch
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
        } else {
          console.log(`Successfully deleted ${filePaths.length} files from ${bucket}`);
          totalDeleted += filePaths.length;
          results.push({
            bucket,
            success: true,
            deletedCount: filePaths.length
          });
        }

      } catch (error) {
        console.error(`Error processing bucket ${bucket}:`, error);
        results.push({
          bucket,
          success: false,
          deletedCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Reset index files by creating empty ones
    const indexFiles = [
      { bucket: BUCKETS.PRODUCTS, filename: 'products-index.json', content: [] },
      { bucket: BUCKETS.CATEGORIES, filename: 'categories-index.json', content: [] },
      { bucket: BUCKETS.ORDERS, filename: 'orders-index.json', content: [] }
    ];

    console.log('Resetting index files...');
    
    for (const indexFile of indexFiles) {
      try {
        const { error: uploadError } = await supabaseAdmin.storage
          .from(indexFile.bucket)
          .upload(indexFile.filename, JSON.stringify(indexFile.content, null, 2), {
            contentType: 'application/json',
            upsert: true
          });

        if (uploadError) {
          console.error(`Error resetting ${indexFile.filename}:`, uploadError);
        } else {
          console.log(`Successfully reset ${indexFile.filename}`);
        }
      } catch (error) {
        console.error(`Error processing ${indexFile.filename}:`, error);
      }
    }

    const successfulBuckets = results.filter(r => r.success).length;
    const failedBuckets = results.filter(r => !r.success).length;

    console.log(`Clear operation completed: ${successfulBuckets} successful, ${failedBuckets} failed, ${totalDeleted} total files deleted`);

    return NextResponse.json({
      success: true,
      message: `Cleared ${successfulBuckets} buckets successfully`,
      totalDeleted,
      results,
      summary: {
        bucketsProcessed: bucketsToClean.length,
        successful: successfulBuckets,
        failed: failedBuckets,
        totalFilesDeleted: totalDeleted
      }
    });

  } catch (error) {
    console.error('Error clearing storage:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear storage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}