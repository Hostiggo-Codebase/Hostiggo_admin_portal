'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('google', { redirect: true, callbackUrl: '/admin/queue' })
    } catch (err) {
      console.error('Sign in error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 dark:bg-blue-600/30 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 dark:bg-emerald-600/30 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md p-6 mx-4">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-2xl font-bold text-white">H</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Hostiggo Admin</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Support Portal</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                {error === 'unauthorized' 
                  ? 'Your email is not authorized to access this portal.'
                  : 'An error occurred. Please try again.'}
              </p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white py-3 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm hover:shadow-md"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
              This portal is for authorized Hostiggo admins only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
