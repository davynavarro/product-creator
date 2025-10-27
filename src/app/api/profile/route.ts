import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { UserProfile, SaveProfileRequest, ProfileApiResponse } from '@/types/user';
import { saveUserProfileToSupabase, getUserProfileFromSupabase } from '@/lib/supabase-storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverUserEmail = searchParams.get('userEmail');
    
    // If userEmail is provided in query params, use it (for server-side calls)
    // Otherwise, use session authentication
    let userEmail: string;
    let userName: string = '';
    let userImage: string | undefined;
    
    if (serverUserEmail) {
      // Server-side call with explicit user email
      userEmail = serverUserEmail;
    } else {
      // Regular client call - require session
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      userEmail = session.user.email;
      userName = session.user.name || '';
      userImage = session.user.image || undefined;
    }
    const profile = await getUserProfileFromSupabase(userEmail);
    
    if (!profile) {
      // Return default profile structure
      const defaultProfile: UserProfile = {
        id: userEmail,
        email: userEmail,
        name: userName,
        image: userImage,
        useBillingAsShipping: true,
        paymentPreferences: {
          saveCards: false,
          autoFillShipping: true,
          autoFillBilling: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return NextResponse.json({
        success: true,
        message: 'Default profile retrieved',
        profile: defaultProfile,
      } as ProfileApiResponse);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile retrieved successfully',
      profile,
    } as ProfileApiResponse);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SaveProfileRequest = await request.json();
    const userEmail = session.user.email;
    
    // Get existing profile or create new one
    const existingProfile = await getUserProfileFromSupabase(userEmail);
    const now = new Date().toISOString();
    
    const updatedProfile: UserProfile = {
      id: userEmail,
      email: userEmail,
      name: session.user.name || '',
      image: session.user.image || undefined,
      useBillingAsShipping: true,
      paymentPreferences: {
        saveCards: false,
        autoFillShipping: true,
        autoFillBilling: true,
      },
      ...existingProfile,
      ...body.profile,
      updatedAt: now,
      createdAt: existingProfile?.createdAt || now,
    };

    // Validate required fields
    if (body.profile.shippingAddress) {
      const { firstName, lastName, address1, city, state, postalCode, country } = body.profile.shippingAddress;
      if (!firstName || !lastName || !address1 || !city || !state || !postalCode || !country) {
        return NextResponse.json(
          { error: 'Missing required shipping address fields' },
          { status: 400 }
        );
      }
    }

    if (body.profile.billingAddress && !body.profile.useBillingAsShipping) {
      const { firstName, lastName, address1, city, state, postalCode, country } = body.profile.billingAddress;
      if (!firstName || !lastName || !address1 || !city || !state || !postalCode || !country) {
        return NextResponse.json(
          { error: 'Missing required billing address fields' },
          { status: 400 }
        );
      }
    }

    // Save to Supabase
    try {
      await saveUserProfileToSupabase(updatedProfile);
    } catch (saveError) {
      console.error('Error saving profile to Supabase:', saveError);
      return NextResponse.json(
        { error: 'Failed to save profile to storage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
    } as ProfileApiResponse);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}