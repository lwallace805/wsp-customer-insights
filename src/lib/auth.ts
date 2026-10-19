import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { isDemo } from '@/lib/demo/flag';
import { isAllowedEmail } from '@/lib/allowedEmails';

const providers: NextAuthOptions['providers'] = [
  GoogleProvider({
    clientId:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

// Demo deployments authenticate with a single shared password (DEMO_PASSWORD)
// so the demo can be shared externally without @wallstreetprep.com accounts.
// This provider only exists when NEXT_PUBLIC_DEMO_MODE=1 — production is
// unchanged (Google-only).
if (isDemo()) {
  providers.push(
    CredentialsProvider({
      name: 'Demo',
      credentials: { password: { label: 'Password', type: 'password' } },
      async authorize(creds) {
        const expected = process.env.DEMO_PASSWORD;
        if (expected && creds?.password === expected) {
          return { id: 'demo', name: 'Demo Viewer', email: 'demo@wallstreetprep.com' };
        }
        return null;
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,

  callbacks: {
    // Allow the demo password provider; otherwise the account must be on
    // @wallstreetprep.com or on the ALLOWED_EXTERNAL_EMAILS allowlist (see
    // allowedEmails.ts — the same predicate is enforced again in middleware).
    async signIn({ account, profile }) {
      if (account?.provider === 'credentials') return true;
      // Google reports whether it has verified ownership of the address. A
      // guest address only counts when it is verified.
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (verified === false) return false;
      return isAllowedEmail(profile?.email);
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
