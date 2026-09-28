import type { DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import type { JWT } from 'next-auth/jwt'
import type { Account } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      role?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    provider?: string
  }
}

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || 'build-time-secret-placeholder-minimum-32-chars-long',
  callbacks: {
    async jwt({ token, user, account }: { token: JWT; user?: any; account?: Account | null }) {
      if (account) {
        token.provider = account.provider
      }
      if (user?.role) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (token) {
        session.user.id = token.sub || ''
        session.user.role = token.role as string || 'user'
      }
      return session
    },
    async signIn({ user, profile }: { user?: any; profile?: any }) {
      if (!profile?.email) {
        return false
      }

      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/check-admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: profile.email }),
        })

        if (!response.ok) {
          console.error(`Unauthorized login attempt: ${profile.email}`)
          return '/login?error=unauthorized'
        }

        const { adminData } = await response.json()

        const syncResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/sync-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: profile.email,
            name: profile.name,
            image: user.image,
            role: adminData?.role || 'admin',
            provider: 'google',
            emailVerified: profile.email_verified || false,
          }),
        })

        return syncResponse.ok
      } catch (error) {
        console.error('Error during sign-in:', error)
        return false
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
}