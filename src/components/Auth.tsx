import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Sparkles, MessageSquare, AlertCircle, Key, RefreshCw } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate
    if (!email || !password) {
      setErrorMsg('Please fill in all core fields.');
      setLoading(false);
      return;
    }

    if (isSignUp && !username) {
      setErrorMsg('Please choose a username.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Signup
        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              avatar_url: avatarUrl,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          // Auto-logged in
          onAuthSuccess();
        } else {
          setSuccessMsg('Account created successfully! Check your email for a confirmation link (if enabled in Supabase), or try logging in.');
          setIsSignUp(false);
        }
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const currentAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative ambient background glows aligned with Immersive UI theme */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600 rounded-full filter blur-[128px] opacity-15 pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600 rounded-full filter blur-[128px] opacity-15 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#0C0C0E]/90 border border-slate-800/60 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/20 mb-3">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white flex items-center gap-2">
            Realtime Chat <span className="text-xs font-mono font-normal py-0.5 px-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">v1.0</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isSignUp ? 'Create a secure account to join rooms' : 'Sign in to connect in real-time'}
          </p>
        </div>

        {/* Info alerts */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-red-950/40 border border-red-500/30 text-red-200 text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2 overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2 overflow-hidden"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
                      maxLength={15}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Lowercase letters, numbers, and underscores only. Max 15 chars.</span>
                </div>

                {/* Avatar Previewer on Sign Up */}
                <div className="bg-slate-900/30 border border-slate-800/60 p-3 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center p-1 relative">
                      <img src={currentAvatarUrl} alt="Avatar Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Your Avatar</h4>
                      <p className="text-[10px] text-slate-400">Random robot vector</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={regenerateAvatar}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors"
                    title="Regenerate Seed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
                minLength={6}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Minimum 6 characters.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-cyan-900/30 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
