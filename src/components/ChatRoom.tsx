import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Room, Message, Profile, PresenceUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Plus,
  Send,
  User,
  Users,
  LogOut,
  Hash,
  Crown,
  Search,
  Globe,
  Radio,
  Clock,
  Menu,
  X,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface ChatRoomProps {
  userProfile: Profile;
  onSignOut: () => void;
}

export default function ChatRoom({ userProfile, onSignOut }: ChatRoomProps) {
  // Navigation & Rooms State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchRoomsQuery, setSearchRoomsQuery] = useState('');

  // Messages State
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Realtime Presence State
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);

  // Responsiveness / UI State
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageListenerRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // 1. Initial Load: Fetch Rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  // 2. Fetch All Rooms from Supabase
  const fetchRooms = async () => {
    try {
      setRoomsLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setRooms(data || []);

      // Autofocus the first room or default General
      if (data && data.length > 0) {
        const generalRoom = data.find((r) => r.name.toLowerCase() === 'general');
        setActiveRoom(generalRoom || data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching rooms:', err.message);
    } finally {
      setRoomsLoading(false);
    }
  };

  // 3. Create a New Channel Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newRoomName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName) return;

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ name: cleanName, created_by: userProfile.id }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setRooms((prev) => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        setActiveRoom(data[0]);
        setNewRoomName('');
        setShowCreateModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Could not create room. It might already exist!');
    }
  };

  // 4. Load Messages for Active Room
  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      return;
    }

    const loadMessagesAndSubscribe = async () => {
      setMessagesLoading(true);
      setMessagesError(null);

      try {
        // Fetch last 50 messages
        const { data, error } = await supabase
          .from('messages')
          .select('id, room_id, user_id, content, created_at, profiles (username, avatar_url)')
          .eq('room_id', activeRoom.id)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;
        setMessages(data || []);
      } catch (err: any) {
        setMessagesError('Failed to load chat history. Ensure tables exist and database setup is finalized.');
        console.error('Load messages error:', err);
      } finally {
        setMessagesLoading(false);
        // Autoscroll bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

      // Cleanup existing subscription if present
      if (messageListenerRef.current) {
        supabase.removeChannel(messageListenerRef.current);
      }

      // Cleanup existing presence connection if present
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }

      // ==========================================
      // REAL-TIME MESSAGING LISTEN SYSTEM
      // ==========================================
      const roomChannelName = `room_messages:${activeRoom.id}`;
      const channel = supabase
        .channel(roomChannelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${activeRoom.id}`,
          },
          async (payload: any) => {
            const newMsg = payload.new;

            // Fetch profile for sender
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', newMsg.user_id)
              .single();

            const completedMsg: Message = {
              id: newMsg.id,
              room_id: newMsg.room_id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              created_at: newMsg.created_at,
              profiles: profileData
                ? {
                    username: profileData.username,
                    avatar_url: profileData.avatar_url,
                  }
                : null,
            };

            // Idempotent Append (guards against duplicate insertions)
            setMessages((prev) => {
              if (prev.some((m) => m.id === completedMsg.id)) return prev;
              const next = [...prev, completedMsg];
              return next;
            });

            // Delay scroll to let DOM update
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }
        );

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to real-time messages: ${activeRoom.name}`);
        }
      });
      messageListenerRef.current = channel;

      // ==========================================
      // REAL-TIME PRESENCE indicators SYSTEM
      // ==========================================
      const presenceChannelName = `presence:${activeRoom.id}`;
      const prChannel = supabase.channel(presenceChannelName, {
        config: {
          presence: {
            key: userProfile.id,
          },
        },
      });

      prChannel
        .on('presence', { event: 'sync' }, () => {
          const rawState = prChannel.presenceState();
          const mappedUsers: PresenceUser[] = [];

          Object.keys(rawState).forEach((key) => {
            const records = rawState[key] as any[];
            records.forEach((record) => {
              mappedUsers.push({
                user_id: key,
                username: record.username || 'Anonymous',
                avatar_url: record.avatar_url || '',
                online_at: record.online_at || new Date().toISOString(),
              });
            });
          });

          // Filter duplicates on user ID for clean presentation
          const uniqUsers = mappedUsers.filter(
            (usr, idx, arr) => arr.findIndex((u) => u.user_id === usr.user_id) === idx
          );

          setPresenceList(uniqUsers);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User entered channels:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('User exited channels:', key, leftPresences);
        });

      prChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await prChannel.track({
            username: userProfile.username,
            avatar_url: userProfile.avatar_url || '',
            online_at: new Date().toISOString(),
          });
        }
      });

      presenceChannelRef.current = prChannel;
    };

    loadMessagesAndSubscribe();

    // Cleanups
    return () => {
      if (messageListenerRef.current) {
        supabase.removeChannel(messageListenerRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [activeRoom, userProfile]);

  // 5. Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = newMessageText.trim();
    if (!cleanContent || !activeRoom) return;

    try {
      setNewMessageText(''); // Optimistic cleared input

      const { data, error } = await supabase.from('messages').insert([
        {
          room_id: activeRoom.id,
          user_id: userProfile.id,
          content: cleanContent,
        },
      ]).select();

      if (error) throw error;

      // Optimistic self append to speed up instant viewing
      if (data && data[0]) {
        const tempMsg: Message = {
          id: data[0].id,
          room_id: data[0].room_id,
          user_id: data[0].user_id,
          content: data[0].content,
          created_at: data[0].created_at,
          profiles: {
            username: userProfile.username,
            avatar_url: userProfile.avatar_url,
          },
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === tempMsg.id)) return prev;
          return [...prev, tempMsg];
        });
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } catch (err: any) {
      console.error('Error writing message:', err.message);
    }
  };

  const handleSignOutClick = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  // Human friendly formatting
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchRoomsQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#09090B] text-slate-200 overflow-hidden font-sans relative">
      {/* Mobile Toggle Button */}
      <div className="absolute top-4 left-4 z-40 md:hidden">
        <button
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="p-2.5 bg-slate-900 border border-slate-800/60 rounded-lg text-slate-300 hover:text-white transition-colors"
        >
          {showMobileSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* SIDEBAR: Channels and Profiles list */}
      <aside
        className={`${
          showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
        } fixed md:relative md:translate-x-0 top-0 left-0 h-full w-72 bg-[#0C0C0E] border-r border-slate-800/60 z-30 transition-transform duration-300 ease-in-out flex flex-col`}
      >
        {/* Brand Banner */}
        <div className="p-6 border-b border-slate-850/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-900/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-semibold text-white text-sm tracking-tight">Realtime Feed</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Workspace App</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 pl-1">
            <span className="text-[10px] font-mono tracking-wider text-cyan-400 font-semibold bg-cyan-950/20 border border-cyan-900/30 px-1.5 py-0.5 rounded">ONLINE</span>
          </div>
        </div>

        {/* User profile area */}
        <div className="p-4 bg-slate-950/20 border-b border-slate-850/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 p-1 shrink-0 overflow-hidden">
                <img
                  src={userProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userProfile.username}`}
                  alt="Profile"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0C0C0E] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold truncate text-white">@{userProfile.username}</h4>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-widest font-bold">Active User</p>
            </div>
          </div>
          <button
            onClick={handleSignOutClick}
            className="p-2 hover:bg-slate-800/60 text-slate-400 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Room search bar */}
        <div className="px-4 py-3 border-b border-slate-850/20">
          <div className="relative group">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchRoomsQuery}
              onChange={(e) => setSearchRoomsQuery(e.target.value)}
              placeholder="Search chat rooms..."
              className="w-full bg-slate-900/50 border border-slate-850 text-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-hidden focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
            />
          </div>
        </div>

        {/* Room Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Channels ({filteredRooms.length})
            </span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 text-slate-500 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Create Room"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {roomsLoading ? (
            <div className="space-y-2 p-2">
              <div className="h-6 bg-slate-900/30 rounded-md animate-pulse" />
              <div className="h-6 bg-slate-900/30 rounded-md animate-pulse" />
              <div className="h-6 bg-slate-900/30 rounded-md animate-pulse" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-600 font-sans">No rooms found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[11px] text-cyan-400 hover:underline mt-1 cursor-pointer font-sans"
              >
                Create one now
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = activeRoom?.id === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveRoom(room);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-500 text-cyan-50 font-medium'
                      : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="opacity-40 font-mono text-xs">#</span>
                    <span className="truncate">{room.name}</span>
                  </div>
                  {room.created_by === userProfile.id && (
                    <Crown className="w-3 h-3 text-amber-500/80 shrink-0" title="Creator" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Live Pulse Panel representation from design */}
        <div className="p-4">
          <div className="bg-slate-900/80 border border-slate-800/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Pulse</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Connected via WebSockets. Active presence tracking sync latency: 38ms.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full bg-[#09090B] font-sans relative overflow-hidden pl-0 md:pl-0">
        {activeRoom ? (
          <div className="h-full flex flex-col">
            {/* Header Area */}
            <div className="h-16 border-b border-slate-800/60 bg-[#09090B]/80 backdrop-blur-xl px-6 flex items-center justify-between relative z-10 pl-16 md:pl-6">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-slate-500 font-mono font-normal">#</span>
                    {activeRoom.name}
                  </h1>
                  <span className="text-[10px] text-slate-500 uppercase tracking-tighter hidden sm:inline">
                    Highly scalable realtime chat infrastructure
                  </span>
                </div>
              </div>

              {/* Online Users Count Panel */}
              <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-medium text-slate-300">
                  {presenceList.length} Online
                </span>

                {/* Micro tooltip containing names of online users */}
                <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-800">
                  {presenceList.slice(0, 3).map((u) => (
                    <div
                      key={u.user_id}
                      className="w-5 h-5 rounded-md bg-slate-850 border border-slate-700/60 flex items-center justify-center overflow-hidden shrink-0"
                      title={`@${u.username} is online`}
                    >
                      <img
                        src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                  {presenceList.length > 3 && (
                    <span className="text-[10px] text-slate-500 font-mono pl-1">
                      +{presenceList.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading && messages.length === 0 ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-start animate-pulse">
                      <div className="w-9 h-9 rounded-lg bg-slate-800/60 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="h-3.5 bg-slate-800/60 rounded-md w-32" />
                        <div className="h-9 bg-slate-800/40 rounded-lg w-full max-w-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-4">
                  <div className="w-12 h-12 bg-red-950/40 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Database Missing Tables</h3>
                  <p className="text-xs text-slate-400 mt-1 lines-spaced mb-4">
                    {messagesError}
                  </p>
                  <p className="text-xs text-violet-400 bg-violet-950/30 border border-violet-900/30 px-3 py-2 rounded-lg font-mono">
                    Please copy current schema from the 'supabase_setup.sql' file and run it inside the Supabase SQL Editor.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 select-none">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-3">
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-xs">No messages yet. Send a whisper to start the dialogue!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* System Date Message */}
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-slate-800/50"></div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Realtime Chat History Feed</span>
                    <div className="flex-1 h-px bg-slate-800/50"></div>
                  </div>

                  {messages.map((msg, index) => {
                    const isCurrentUser = msg.user_id === userProfile.id;
                    const senderName = msg.profiles?.username || 'Anonymous';
                    const senderAvatar =
                      msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${senderName}`;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex items-start gap-4 max-w-4xl ${
                          isCurrentUser ? 'flex-row-reverse self-end ml-auto' : ''
                        }`}
                      >
                        {/* Sender Avatar */}
                        <div className={`w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold p-1 border shadow-xs ${
                          isCurrentUser 
                            ? 'bg-cyan-900/30 border-cyan-500/20 text-cyan-400' 
                            : 'bg-indigo-900/30 border-indigo-500/18 text-indigo-400'
                        }`}>
                          <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Content Card */}
                        <div className={`flex flex-col gap-1 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                              {isCurrentUser ? 'You' : senderName}
                            </span>
                            <span className="text-[9px] text-slate-600 tracking-wider">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>

                          <div
                            className={`px-4 py-3 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words max-w-lg md:max-w-2xl ${
                              isCurrentUser
                                ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-l-2xl rounded-br-2xl shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
                                : 'bg-slate-900 border border-slate-800 px-4 py-3 rounded-r-2xl rounded-bl-2xl text-slate-300'
                            }`}
                          >
                            {msg.content}
                          </div>

                          {isCurrentUser && (
                            <div className="flex items-center gap-1.5 mt-0.5 pr-1">
                              <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Delivered</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Area styled as Immersive UI Footer */}
            <div className="p-6">
              <form onSubmit={handleSendMessage} className="bg-slate-900/60 border border-slate-800 p-2 rounded-2xl flex items-center gap-2 shadow-2xl">
                <div className="w-10 h-10 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 select-none">
                  <span className="text-slate-500 font-mono font-normal">#</span>
                </div>
                <input
                  type="text"
                  required
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder={`Message #${activeRoom.name}...`}
                  className="flex-1 bg-transparent border-hidden outline-hidden text-sm px-2 focus:outline-hidden focus:ring-0 text-slate-200 placeholder:text-slate-600"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all shadow-lg shadow-cyan-900/30 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              
              {/* Optional user ambient typing placeholder from design */}
              <div className="mt-2.5 flex items-center gap-4 pl-1">
                <div className="flex items-center gap-1.5 h-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse"></div>
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider italic">Realtime latency monitoring active</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty onboarding landing page */
          <div className="h-full flex flex-col items-center justify-center p-8 max-w-sm mx-auto text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-900/20 mb-5 animate-pulse text-white">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">No Channel Selected</h2>
            <p className="text-xs text-slate-400 mt-2 lines-spaced">
              You must choose an existing chat room folder from the sidebar navigation menu, or create a new public room to connect in real-time.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-cyan-400 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Channel Room</span>
            </button>
          </div>
        )}
      </main>

      {/* CREATE ROOM COMPONENT MODAL BANNER */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0C0C0E] border border-slate-800/80 rounded-2xl p-6.5 shadow-2xl relative"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-mono font-normal">#</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Channel</h3>
                  <p className="text-[10px] text-slate-500">Public rooms are open to everyone</p>
                </div>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Room Name</label>
                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) =>
                      setNewRoomName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
                    }
                    placeholder="e.g. general-tech"
                    className="w-full bg-[#09090B] border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-cyan-500 transition-colors"
                    maxLength={20}
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Use lowercase letters, numbers, and hyphens only. Max 20 chars.
                  </span>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-1.5 hover:bg-slate-800 text-slate-400 text-xs rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-md shadow-md cursor-pointer transition-colors"
                  >
                    Create Room
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
