import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCartCacheStats, clearExpiredCartCache } from '@/lib/supabase-storage';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins to view cache stats (you can implement your own admin check)
    // For now, just check if email contains 'admin' - replace with proper admin logic
    const isAdmin = session.user.email.includes('admin') || process.env.NODE_ENV === 'development';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action } = Object.fromEntries(new URL(request.url).searchParams);

    if (action === 'clear-expired') {
      const clearedCount = clearExpiredCartCache();
      return NextResponse.json({
        message: `Cleared ${clearedCount} expired cache entries`,
        stats: getCartCacheStats()
      });
    }

    return NextResponse.json({
      cacheStats: getCartCacheStats(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}