import { NextResponse } from 'next/server';
import { listAllBlobs } from '@/lib/blob-storage';
import { del } from '@vercel/blob';

export async function DELETE() {
  try {
    console.log('Starting to clear all blob storage...');
    
    // Get all blobs in storage
    const allBlobs = await listAllBlobs();
    console.log(`Found ${allBlobs.length} blobs to delete`);

    if (allBlobs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No blobs found to delete',
        deletedCount: 0 
      });
    }

    // Delete all blobs
    const deletePromises = allBlobs.map(async (blob) => {
      try {
        console.log(`Deleting blob: ${blob.pathname}`);
        await del(blob.url);
        return { success: true, pathname: blob.pathname };
      } catch (error) {
        console.error(`Failed to delete blob ${blob.pathname}:`, error);
        return { success: false, pathname: blob.pathname, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.allSettled(deletePromises);
    
    // Count successful deletions
    let successCount = 0;
    let failureCount = 0;
    const failures: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failureCount++;
        const blobPath = allBlobs[index]?.pathname || 'unknown';
        failures.push(blobPath);
      }
    });

    console.log(`Deletion complete: ${successCount} successful, ${failureCount} failed`);

    if (failureCount > 0) {
      console.warn('Some deletions failed:', failures);
    }

    return NextResponse.json({
      success: true,
      message: `Cleared blob storage: ${successCount} items deleted${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      deletedCount: successCount,
      failureCount,
      failures: failureCount > 0 ? failures : undefined
    });

  } catch (error) {
    console.error('Error clearing blob storage:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear blob storage',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Optional: Add a GET endpoint to preview what would be deleted
export async function GET() {
  try {
    const allBlobs = await listAllBlobs();
    
    const preview = allBlobs.map(blob => ({
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt
    }));

    return NextResponse.json({
      success: true,
      totalBlobs: allBlobs.length,
      totalSize: allBlobs.reduce((sum, blob) => sum + blob.size, 0),
      blobs: preview
    });
  } catch (error) {
    console.error('Error listing blobs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list blobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}