import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth/options'

const authHandler = NextAuth(authOptions)

export { authHandler as GET, authHandler as POST }
