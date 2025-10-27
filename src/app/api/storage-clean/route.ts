import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE() {
  try {
    console.log('Starting storage cleanup...');
    
    let totalDeleted = 0;
    const results = [];
    
    // Clean products bucket
    const { data: productFiles } = await supabaseAdmin.storage.from('products').list();
    if (productFiles && productFiles.length > 0) {
      const filePaths = productFiles.map(f => f.name);
      await supabaseAdmin.storage.from('products').remove(filePaths);
      totalDeleted += filePaths.length;
      results.push(`Deleted ${filePaths.length} files from products`);
    }
    
    // Clean other buckets
    const otherBuckets = ['images', 'cart', 'categories'];
    for (const bucket of otherBuckets) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list();
      if (files && files.length > 0) {
        const filePaths = files.map(f => f.name);
        await supabaseAdmin.storage.from(bucket).remove(filePaths);
        totalDeleted += filePaths.length;
        results.push(`Deleted ${filePaths.length} files from ${bucket}`);
      }
    }
    
    // Recreate empty index files
    console.log('Creating empty index files...');
    
    const { error: productsIndexError } = await supabaseAdmin.storage
      .from('products')
      .upload('products-index.json', JSON.stringify([], null, 2), { 
        contentType: 'application/json',
        upsert: true 
      });
    
    const { error: categoriesError } = await supabaseAdmin.storage
      .from('categories')
      .upload('categories.json', JSON.stringify([], null, 2), { 
        contentType: 'application/json',
        upsert: true 
      });
    
    if (productsIndexError) {
      console.error('Error creating products index:', productsIndexError);
    } else {
      console.log('Created empty products-index.json');
    }
    
    if (categoriesError) {
      console.error('Error creating categories index:', categoriesError);
    } else {
      console.log('Created empty categories.json');
    }
    
    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
      message: 'Storage cleaned and reset'
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}