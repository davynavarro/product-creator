import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user && token) {
        session.user.id = token.userId as string;
        session.accessToken = token.accessToken as string;
        session.provider = token.provider as string;
      }
      return session;
    },
    async signIn({ account }) {
      // You can add custom logic here to save user data to your database
      // For now, we'll allow all Google sign-ins
      if (account?.provider === 'google') {
        return true;
      }
      return false;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};