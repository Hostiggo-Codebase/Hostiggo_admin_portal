'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated gradient background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/30 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] left-[40%] w-[30%] h-[30%] rounded-full bg-purple-600/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md p-8 mx-4">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl shadow-black/50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-2xl font-bold text-white">H</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Hostiggo Support</h1>
            <p className="text-slate-300 text-sm">Welcome back! Sign in to continue.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
