import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // Block sign-in for any email not on @wallstreetprep.com
    async signIn({ profile }) {
      const email = profile?.email ?? '';
      return email.endsWith('@wallstreetprep.com');
    },

    // Forward the email into the session so we can display it if needed
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },

  pages: {
    signIn:  '/login',
    error:   '/login',   // errors (e.g. wrong domain) redirect here with ?error=
  },

  session: {
    strategy: 'jwt',
    maxAge:   60 * 60 * 24 * 30, // 30 days
  },
};
