import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Profile } from './types';
import Auth from './components/Auth';
import ChatRoom from './components/ChatRoom';
import { RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 1. Listen for Supabase session changes
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('Error fetching session:', error);
        setErrorText('Failed to establish session. Check public anon key configurations.');
      }
      setSession(initialSession);
      if (initialSession) {
        fetchUserProfile(initialSession.user.id, initialSession.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id, currentSession.user);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch or lazy-create Profile
  const fetchUserProfile = async (userId: string, userAuth: any, retryCount = 0) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile was not found on first registration, trigger may be completing. Let's retry!
        if (retryCount < 3) {
          console.log(`Profile not found, retrying... Attempt ${retryCount + 1}`);
          setTimeout(() => {
            fetchUserProfile(userId, userAuth, retryCount + 1);
          }, 1000);
          return;
        }

        // Fallback: build temporary profile from auth metadata to prevent blocking
        const fallbackProfile: Profile = {
          id: userId,
          username: userAuth.user_metadata?.username || userAuth.email?.split('@')[0] || 'stranger',
          avatar_url: userAuth.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
          updated_at: new Date().toISOString(),
        };

        // Attempt to write the missing profile for self-healing
        await supabase.from('profiles').insert([fallbackProfile]);
        setUserProfile(fallbackProfile);
      } else {
        setUserProfile(data);
      }
    } catch (err: any) {
      console.error('Fetch profile exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id, currentSession.user);
      } else {
        setLoading(false);
      }
    });
  };

  const handleSignOut = () => {
    setSession(null);
    setUserProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
        {/* Ambient backdrop bubbles */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600 rounded-full filter blur-[128px] opacity-15 pointer-events-none animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600 rounded-full filter blur-[128px] opacity-15 pointer-events-none animate-pulse" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center max-w-sm text-center relative z-10"
        >
          <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-900/10 mb-4 animate-bounce">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-white font-semibold font-display tracking-tight text-sm">Synchronizing Session</h2>
          <p className="text-xs text-slate-400 mt-1 lines-spaced mb-6">
            Establishing secure handshake connection with Supabase database cluster...
          </p>
          <RefreshCw className="w-4.5 h-4.5 text-cyan-400 animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="w-12 h-12 bg-red-950/40 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-white font-bold font-display text-base">Handshake Error</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm lines-spaced mb-6">
          {errorText}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 text-xs font-semibold rounded-lg"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <>
      {session && userProfile ? (
        <ChatRoom userProfile={userProfile} onSignOut={handleSignOut} />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}
    </>
  );
}
