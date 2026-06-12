import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Room, Message, Profile, PresenceUser, Friendship } from '../types';
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
  AlertCircle,
  CornerUpLeft,
  Smile,
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
  MessageCircle,
  Paperclip,
  Mic,
  Square,
  Trash2,
  Pencil,
  Check
} from 'lucide-react';

interface ChatRoomProps {
  userProfile: Profile;
  onSignOut: () => void;
}

const CHAT_EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '😎', '🤔', '🤨', '🙄', '😬', '😔', '😢', '😭', '😡', '😱',
  '👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🙏', '🔥', '✨', '⚡', '💡', '🎉', '🎈', '❤️', '💖', '💔', '🌹',
  '👑', '⭐', '🎁', '🍕', '☕', '🐱', '🐶', '🚀', '🌈'
];

export default function ChatRoom({ userProfile, onSignOut }: ChatRoomProps) {
  // Navigation & Rooms State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeFriend, setActiveFriend] = useState<Profile | null>(null); // NEW: Currently selected friend DM
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
  const [globalPresenceList, setGlobalPresenceList] = useState<string[]>([]); // New list of globally active user IDs

  // Responsiveness / UI State
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  // Replies & Emoji Picker & Friends State
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  // Friendships States
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedProfiles, setSearchedProfiles] = useState<Profile[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Schema Compatibility / Fallback Mode State
  const [dbSupport, setDbSupport] = useState<{
    checked: boolean;
    hasPrivateDMsAndReplies: boolean;
    errorDetails?: string;
  }>({
    checked: false,
    hasPrivateDMsAndReplies: true,
    errorDetails: undefined
  });

  // Message Editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  // Message Reactions state: Record<messageId, Array<{ emoji: string, user_id: string, username: string }>>
  const [messageReactions, setMessageReactions] = useState<Record<string, { emoji: string; user_id: string; username: string }[]>>({});

  // Load reactions from local storage on mount
  useEffect(() => {
    try {
      const rawReactions = localStorage.getItem('local_reactions_map');
      if (rawReactions) {
        setMessageReactions(JSON.parse(rawReactions));
      }
    } catch (e) {
      console.error('Error loading reactions map:', e);
    }
  }, []);

  // ==========================================
  // MEDIA UPLOAD & VOICE RECORDING HANDLERS
  // ==========================================
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'video' | 'audio';
    dataUrl: string;
    fileName?: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Auto clean up recording timer if unmounted
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Format recording seconds as mm:ss
  const formatRecordTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("المتصفح الخاص بك لا يدعم تسجيل الصوت أو يحتاج لاتصال آمن HTTPS.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedMedia({
            type: 'audio',
            dataUrl: reader.result as string,
            fileName: `voice_${Date.now()}.webm`
          });
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      alert('لا يمكن الوصول إلى الميكروفون. يرجى التأكد من تفعيل صلاحيات الصوت في المتصفح.');
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Handle local image / video selections
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) { // Up to 15MB for files
      alert('الحد الأقصى لحجم الملف هو 15 ميجابايت.');
      return;
    }

    const type = file.type.startsWith('image/') 
      ? 'image' 
      : file.type.startsWith('video/') 
        ? 'video' 
        : null;

    if (!type) {
      alert('يرجى اختيار ملف صورة أو فيديو صالح.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedMedia({
        type: type as 'image' | 'video',
        dataUrl: reader.result as string,
        fileName: file.name
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Paste from clipboard handler
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedMedia({
              type: 'image',
              dataUrl: reader.result as string,
              fileName: `pasted_image_${Date.now()}.png`
            });
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Help preview caption metadata
  const getMessagePreviewText = (content: string) => {
    try {
      if (content.startsWith('{"type":"media"') || content.includes('"media_type"')) {
        const parsed = JSON.parse(content);
        if (parsed.type === 'media') {
          const typeLabel = parsed.media_type === 'image' ? '📸 صورة' : parsed.media_type === 'video' ? '🎥 فيديو' : '🎙️ تسجيل صوتي';
          return parsed.text ? `${typeLabel}: ${parsed.text}` : typeLabel;
        }
      }
    } catch {
      // do nothing
    }
    return content;
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListenerRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const globalPresenceChannelRef = useRef<any>(null);
  const friendshipListenerRef = useRef<any>(null);

  // 1. Initial Load: Fetch Rooms, Friendships
  useEffect(() => {
    const init = async () => {
      const isCompat = await checkDatabaseSchema();
      fetchRooms();
      fetchFriendshipsAndProfiles();
    };
    init();
  }, []);

  // 1.5 Check database schema compatibility
  const checkDatabaseSchema = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .select('recipient_id, reply_to_message_id')
        .limit(1);

      if (error) {
        console.warn('Extended companion columns not found in messages. Activating Basic Mode fallback.', error);
        setDbSupport({
          checked: true,
          hasPrivateDMsAndReplies: false,
          errorDetails: `${error.message} (Code: ${error.code || 'None'})`
        });
        return false;
      } else {
        setDbSupport({
          checked: true,
          hasPrivateDMsAndReplies: true,
          errorDetails: undefined
        });
        return true;
      }
    } catch (err: any) {
      console.warn('Network or schema check failed. Activating Basic Mode fallback.', err);
      setDbSupport({
        checked: true,
        hasPrivateDMsAndReplies: false,
        errorDetails: err?.message || String(err)
      });
      return false;
    }
  };

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
        setActiveFriend(null);
      }
    } catch (err: any) {
      console.error('Error fetching rooms:', err.message);
    } finally {
      setRoomsLoading(false);
    }
  };

  // 3. Fetch Friendships & Profiles
  const fetchFriendshipsAndProfiles = async () => {
    if (dbSupport.checked && !dbSupport.hasPrivateDMsAndReplies) {
      try {
        const localFriendsRaw = localStorage.getItem(`local_friendships_${userProfile.id}`);
        if (localFriendsRaw) {
          setFriendships(JSON.parse(localFriendsRaw));
        } else {
          setFriendships([]);
        }
      } catch (err) {
        console.error('Error loading friendships from localStorage:', err);
        setFriendships([]);
      }
      return;
    }
    try {
      setLoadingFriends(true);
      
      // Fetch partnerships involving current user
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${userProfile.id},receiver_id.eq.${userProfile.id}`);

      if (friendsError) throw friendsError;

      const items = friendsData || [];
      const userIds = new Set<string>();
      items.forEach((f) => {
        if (f.sender_id !== userProfile.id) userIds.add(f.sender_id);
        if (f.receiver_id !== userProfile.id) userIds.add(f.receiver_id);
      });

      let profilesList: Profile[] = [];
      if (userIds.size > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIds));
        
        if (profError) throw profError;
        profilesList = profData || [];
      }

      // Map profiles into friendship items
      const mappedFriendships: Friendship[] = items.map((f) => {
        const otherId = f.sender_id === userProfile.id ? f.receiver_id : f.sender_id;
        const otherProfile = profilesList.find((p) => p.id === otherId) || null;
        return {
          ...f,
          sender: f.sender_id === userProfile.id ? userProfile : otherProfile,
          receiver: f.receiver_id === userProfile.id ? userProfile : otherProfile,
        };
      });

      setFriendships(mappedFriendships);
    } catch (err) {
      console.error('Error loading friendships:', err);
      // Failover to local storage just in case the query itself failed due to missing tables
      try {
        const localFriendsRaw = localStorage.getItem(`local_friendships_${userProfile.id}`);
        if (localFriendsRaw) {
          setFriendships(JSON.parse(localFriendsRaw));
        }
      } catch (e) {
        console.error('Local fallback failed:', e);
      }
    } finally {
      setLoadingFriends(false);
    }
  };

  // 4. Friendships and Global Presence Listeners Setup
  useEffect(() => {
    let fChannel: any = null;
    if (dbSupport.hasPrivateDMsAndReplies) {
      // Listen for friendships table updates real-time
      fChannel = supabase
        .channel('realtime_friendships_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          () => {
            fetchFriendshipsAndProfiles();
          }
        )
        .subscribe();

      friendshipListenerRef.current = fChannel;
    }

    // Listen for global presence (to check which friends are currently online in app)
    const globChannelName = `presence:global`;
    const globPrChannel = supabase.channel(globChannelName, {
      config: {
        presence: {
          key: userProfile.id,
        },
      },
    });

    globPrChannel
      .on('presence', { event: 'sync' }, () => {
        const state = globPrChannel.presenceState();
        const activeIds = Object.keys(state);
        setGlobalPresenceList(activeIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globPrChannel.track({
            username: userProfile.username,
            online_at: new Date().toISOString(),
          });
        }
      });

    globalPresenceChannelRef.current = globPrChannel;

    return () => {
      if (friendshipListenerRef.current) {
        supabase.removeChannel(friendshipListenerRef.current);
      }
      if (globalPresenceChannelRef.current) {
        supabase.removeChannel(globalPresenceChannelRef.current);
      }
    };
  }, [userProfile, dbSupport.hasPrivateDMsAndReplies]);

  // 5. Create a New Channel Room
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
        setActiveFriend(null);
        setNewRoomName('');
        setShowCreateModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Could not create room. It might already exist!');
    }
  };

  // 6. Primary Load Messages Effect (Active Room OR Private Friend change)
  useEffect(() => {
    if (!activeRoom && !activeFriend) {
      setMessages([]);
      return;
    }

    const loadMessagesAndSubscribe = async () => {
      setMessagesLoading(true);
      setMessagesError(null);
      setReplyingToMessage(null); // Reset reply state when room switches

      try {
        let selectStr = 'id, room_id, user_id, recipient_id, reply_to_message_id, content, created_at, profiles:profiles!user_id (username, avatar_url)';
        if (dbSupport.checked && !dbSupport.hasPrivateDMsAndReplies) {
          selectStr = 'id, room_id, user_id, content, created_at, profiles:profiles!user_id (username, avatar_url)';
        }

        let query = supabase
          .from('messages')
          .select(selectStr);

        if (activeRoom) {
          query = query.eq('room_id', activeRoom.id);
        } else if (activeFriend && dbSupport.hasPrivateDMsAndReplies) {
          // Fetch DM messages where (A sent to B) OR (B sent to A)
          query = query.or(
            `and(user_id.eq.${userProfile.id},recipient_id.eq.${activeFriend.id}),and(user_id.eq.${activeFriend.id},recipient_id.eq.${userProfile.id})`
          );
        } else if (activeFriend && !dbSupport.hasPrivateDMsAndReplies) {
          try {
            const key = `local_messages_${userProfile.id}_with_${activeFriend.id}`;
            const localMsgsRaw = localStorage.getItem(key);
            if (localMsgsRaw) {
              setMessages(JSON.parse(localMsgsRaw));
            } else {
              setMessages([]);
            }
          } catch (e) {
            setMessages([]);
          }
          setMessagesLoading(false);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return;
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) {
          if (dbSupport.hasPrivateDMsAndReplies) {
            console.warn("Table upgrade columns missing, downgrading query to standard basic mode:", error);
            setDbSupport({ checked: true, hasPrivateDMsAndReplies: false });
            return;
          }
          throw error;
        }
        setMessages(data || []);
      } catch (err: any) {
        if (dbSupport.hasPrivateDMsAndReplies) {
          setDbSupport({ checked: true, hasPrivateDMsAndReplies: false });
          return;
        }
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
      let roomChannelName = '';
      let filterRule: any = {};

      if (activeRoom) {
        roomChannelName = `room_messages:${activeRoom.id}`;
        filterRule = {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${activeRoom.id}`,
        };
      } else if (activeFriend) {
        roomChannelName = `private_messages:${userProfile.id}_with_${activeFriend.id}`;
        filterRule = {
          event: '*',
          schema: 'public',
          table: 'messages',
        };
      }

      const channel = supabase
        .channel(roomChannelName)
        .on(
          'postgres_changes',
          filterRule,
          async (payload: any) => {
            const evType = payload.eventType;

            if (evType === 'DELETE') {
              const oldMsg = payload.old;
              setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
              return;
            }

            if (evType === 'UPDATE') {
              const updatedMsg = payload.new;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === updatedMsg.id ? { ...m, content: updatedMsg.content } : m
                )
              );
              return;
            }

            if (evType === 'INSERT') {
              const newMsg = payload.new;

              // If we are chatting with activeFriend, make sure the inserted message belongs strictly to this thread
              if (activeFriend) {
                const isMatch =
                  newMsg.room_id === null &&
                  ((newMsg.user_id === userProfile.id && newMsg.recipient_id === activeFriend.id) ||
                    (newMsg.user_id === activeFriend.id && newMsg.recipient_id === userProfile.id));
                if (!isMatch) return;
              }

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
                recipient_id: newMsg.recipient_id,
                reply_to_message_id: newMsg.reply_to_message_id,
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
          }
        );

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed: ${activeRoom ? activeRoom.name : 'Private with @' + activeFriend?.username}`);
        }
      });
      messageListenerRef.current = channel;

      // ==========================================
      // REAL-TIME PRESENCE indicators FOR HEADER
      // ==========================================
      const presenceKey = activeRoom ? activeRoom.id : activeFriend?.id;
      if (presenceKey) {
        const presenceChannelName = `presence:${presenceKey}`;
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

            const uniqUsers = mappedUsers.filter(
              (usr, idx, arr) => arr.findIndex((u) => u.user_id === usr.user_id) === idx
            );

            setPresenceList(uniqUsers);
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
      }
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
  }, [activeRoom, activeFriend, userProfile, dbSupport.hasPrivateDMsAndReplies]);

  // 7. Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textContent = newMessageText.trim();
    if (!textContent && !selectedMedia) return;
    if (!activeRoom && !activeFriend) return;

    try {
      const parentId = replyingToMessage?.id || null;
      setNewMessageText(''); // Optimistically clear input
      setReplyingToMessage(null); // Clear reply quote anchor

      const mediaToSend = selectedMedia;
      setSelectedMedia(null); // Clear selected media early optimistically

      let finalContent = textContent;
      if (mediaToSend) {
        finalContent = JSON.stringify({
          type: 'media',
          media_type: mediaToSend.type,
          url: mediaToSend.dataUrl,
          text: textContent
        });
      }

      // If messaging activeFriend and in basic fallback mode, save to localStorage
      if (activeFriend && !dbSupport.hasPrivateDMsAndReplies) {
        const localMsg: Message = {
          id: `local_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          room_id: null,
          user_id: userProfile.id,
          recipient_id: activeFriend.id,
          reply_to_message_id: null,
          content: finalContent,
          created_at: new Date().toISOString(),
          profiles: userProfile
        };

        const key = `local_messages_${userProfile.id}_with_${activeFriend.id}`;
        let localMsgs: Message[] = [];
        try {
          const raw = localStorage.getItem(key);
          if (raw) localMsgs = JSON.parse(raw);
        } catch {}
        localMsgs.push(localMsg);
        localStorage.setItem(key, JSON.stringify(localMsgs));

        // Also save on peer key for local simulation
        const peerKey = `local_messages_${activeFriend.id}_with_${userProfile.id}`;
        let peerMsgs: Message[] = [];
        try {
          const raw = localStorage.getItem(peerKey);
          if (raw) peerMsgs = JSON.parse(raw);
        } catch {}
        peerMsgs.push(localMsg);
        localStorage.setItem(peerKey, JSON.stringify(peerMsgs));

        setMessages(localMsgs);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return;
      }

      const messagePayload: any = {
        user_id: userProfile.id,
        content: finalContent,
      };

      if (activeRoom) {
        messagePayload.room_id = activeRoom.id;
      }

      if (dbSupport.hasPrivateDMsAndReplies) {
        if (activeFriend) {
          messagePayload.recipient_id = activeFriend.id;
        }
        messagePayload.reply_to_message_id = parentId;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([messagePayload])
        .select();

      if (error) throw error;

      // Optimistic self-append to speed up instant viewing
      if (data && data[0]) {
        const tempMsg: Message = {
          id: data[0].id,
          room_id: data[0].room_id,
          recipient_id: dbSupport.hasPrivateDMsAndReplies ? data[0].recipient_id : null,
          user_id: data[0].user_id,
          reply_to_message_id: dbSupport.hasPrivateDMsAndReplies ? data[0].reply_to_message_id : null,
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

  // Update/Edit Message Handler
  const handleUpdateMessage = async (messageId: string, newText: string) => {
    const existingMsg = messages.find((m) => m.id === messageId);
    if (!existingMsg) return;

    let finalContent = newText;
    try {
      if (existingMsg.content.startsWith('{"type":"media"') || existingMsg.content.includes('"media_type"')) {
        const parsed = JSON.parse(existingMsg.content);
        parsed.text = newText;
        finalContent = JSON.stringify(parsed);
      }
    } catch {}

    // 1. If it's a local storage message
    if (messageId.startsWith('local_')) {
      if (activeFriend) {
        const key = `local_messages_${userProfile.id}_with_${activeFriend.id}`;
        let localMsgs: Message[] = [];
        try {
          const raw = localStorage.getItem(key);
          if (raw) localMsgs = JSON.parse(raw);
        } catch {}

        const updated = localMsgs.map((m) => m.id === messageId ? { ...m, content: finalContent } : m);
        localStorage.setItem(key, JSON.stringify(updated));
        setMessages(updated);
      }
      setEditingMessageId(null);
      return;
    }

    // 2. If it is a Supabase message
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: finalContent })
        .eq('id', messageId);

      if (error) throw error;

      // Optimistic locally
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: finalContent } : m))
      );
      setEditingMessageId(null);
    } catch (err: any) {
      alert("تعذر تعديل الرسالة. يرجى تفعيل سياسة تحديث الرسائل في Supabase RLS.");
      console.error('Edit message error:', err);
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) return;

    // 1. If it's a local message
    if (messageId.startsWith('local_')) {
      if (activeFriend) {
        const key = `local_messages_${userProfile.id}_with_${activeFriend.id}`;
        let localMsgs: Message[] = [];
        try {
          const raw = localStorage.getItem(key);
          if (raw) localMsgs = JSON.parse(raw);
        } catch {}

        const filtered = localMsgs.filter((m) => m.id !== messageId);
        localStorage.setItem(key, JSON.stringify(filtered));
        setMessages(filtered);
      }
      return;
    }

    // 2. If it is a Supabase message
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      // Optimistic locally
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      alert("تعذر حذف الرسالة. يرجى تفعيل سياسة الحذف في Supabase RLS.");
      console.error('Delete message error:', err);
    }
  };

  // Toggle reaction with local fallback
  const toggleReaction = async (messageId: string, emoji: string) => {
    // Toggle in local map first (optimistic and fallback)
    const currentReactions = messageReactions[messageId] || [];
    const existsIdx = currentReactions.findIndex(
      (r) => r.user_id === userProfile.id && r.emoji === emoji
    );

    let nextReactions = [...currentReactions];
    if (existsIdx > -1) {
      nextReactions.splice(existsIdx, 1);
    } else {
      nextReactions.push({
        emoji,
        user_id: userProfile.id,
        username: userProfile.username,
      });
    }

    const nextMap = { ...messageReactions, [messageId]: nextReactions };
    setMessageReactions(nextMap);
    localStorage.setItem('local_reactions_map', JSON.stringify(nextMap));

    // Try sending to Supabase if advanced DB features are active
    if (dbSupport.hasPrivateDMsAndReplies) {
      try {
        if (existsIdx > -1) {
          await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', userProfile.id)
            .eq('emoji', emoji);
        } else {
          await supabase.from('message_reactions').insert([
            {
              message_id: messageId,
              user_id: userProfile.id,
              emoji: emoji,
            },
          ]);
        }
      } catch (err) {
        console.warn('Syncing reaction with DB failed (using local storage fallback instead).');
      }
    }
  };

  // 8. Find Registered Users to add/invite
  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setSearchedProfiles([]);
      return;
    }

    try {
      setLoadingSearch(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userProfile.id)
        .ilike('username', `%${query.trim()}%`)
        .limit(10);

      if (error) throw error;
      setSearchedProfiles(data || []);
    } catch (err) {
      console.error('Search users error:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Friend Request Actions
  const handleSendRequest = async (receiverId: string) => {
    if (dbSupport.checked && !dbSupport.hasPrivateDMsAndReplies) {
      try {
        const receiverProf = searchedProfiles.find((p) => p.id === receiverId);
        if (!receiverProf) return;

        const localFriendsRaw = localStorage.getItem(`local_friendships_${userProfile.id}`) || '[]';
        const currentLocal: Friendship[] = JSON.parse(localFriendsRaw);

        if (currentLocal.some((f) => (f.sender_id === userProfile.id && f.receiver_id === receiverId) || (f.sender_id === receiverId && f.receiver_id === userProfile.id))) {
          alert("هذا المستخدم مضاف بالفعل أو طلب معلق.");
          return;
        }

        const newFriendship: Friendship = {
          id: `local_${Date.now()}_fg`,
          sender_id: userProfile.id,
          receiver_id: receiverId,
          status: 'accepted', // Auto-accept locally so they are friends immediately
          created_at: new Date().toISOString(),
          sender: userProfile,
          receiver: receiverProf,
        };

        const nextLocal = [...currentLocal, newFriendship];
        localStorage.setItem(`local_friendships_${userProfile.id}`, JSON.stringify(nextLocal));
        setFriendships(nextLocal);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('friendships')
        .insert([{ sender_id: userProfile.id, receiver_id: receiverId, status: 'pending' }]);

      if (error) throw error;
      fetchFriendshipsAndProfiles();
    } catch (err: any) {
      alert(err.message || 'Could not send friend request.');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    if (dbSupport.checked && !dbSupport.hasPrivateDMsAndReplies) {
      try {
        const localFriendsRaw = localStorage.getItem(`local_friendships_${userProfile.id}`) || '[]';
        const currentLocal: Friendship[] = JSON.parse(localFriendsRaw);
        const nextLocal = currentLocal.map((f) => f.id === friendshipId ? { ...f, status: 'accepted' } : f);
        localStorage.setItem(`local_friendships_${userProfile.id}`, JSON.stringify(nextLocal));
        setFriendships(nextLocal);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;
      fetchFriendshipsAndProfiles();
    } catch (err: any) {
      alert(err.message || 'Could not accept friendship.');
    }
  };

  const handleDeclineOrRemove = async (friendshipId: string) => {
    if (dbSupport.checked && !dbSupport.hasPrivateDMsAndReplies) {
      try {
        const localFriendsRaw = localStorage.getItem(`local_friendships_${userProfile.id}`) || '[]';
        const currentLocal: Friendship[] = JSON.parse(localFriendsRaw);
        const nextLocal = currentLocal.filter((f) => f.id !== friendshipId);
        localStorage.setItem(`local_friendships_${userProfile.id}`, JSON.stringify(nextLocal));
        setFriendships(nextLocal);

        const unfriendship = currentLocal.find((f) => f.id === friendshipId);
        if (unfriendship) {
          const otherId = unfriendship.sender_id === userProfile.id ? unfriendship.receiver_id : unfriendship.sender_id;
          if (activeFriend && activeFriend.id === otherId) {
            setActiveFriend(null);
            if (rooms.length > 0) {
              setActiveRoom(rooms[0]);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      
      // If unfriending activeDM partner, reset view to General room
      const unfriendship = friendships.find((f) => f.id === friendshipId);
      if (unfriendship) {
        const otherId = unfriendship.sender_id === userProfile.id ? unfriendship.receiver_id : unfriendship.sender_id;
        if (activeFriend && activeFriend.id === otherId) {
          setActiveFriend(null);
          if (rooms.length > 0) {
            setActiveRoom(rooms[0]);
          }
        }
      }

      fetchFriendshipsAndProfiles();
    } catch (err: any) {
      alert(err.message || 'Could not decline or unfriend.');
    }
  };

  const handleSignOutClick = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  // Emojis helper
  const handlePickEmoji = (emoji: string) => {
    setNewMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Scroll to a referenced parent message (Reply Quote jump)
  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-cyan-500', 'ring-offset-2', 'ring-offset-[#09090B]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-cyan-500', 'ring-offset-2', 'ring-offset-[#09090B]');
      }, 2000);
    }
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

  // Categorize our friendships list
  const acceptedFriends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.sender_id === userProfile.id ? f.receiver : f.sender))
    .filter((profile): profile is Profile => !!profile);

  const pendingReceivedRequests = friendships.filter(
    (f) => f.status === 'pending' && f.receiver_id === userProfile.id
  );

  const pendingSentRequests = friendships.filter(
    (f) => f.status === 'pending' && f.sender_id === userProfile.id
  );

  return (
    <div className="flex h-screen bg-[#09090B] text-slate-200 overflow-hidden font-sans relative">
      {/* Mobile Toggle Button */}
      <div className="absolute top-4 left-4 z-40 md:hidden">
        <button
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="p-2.5 bg-slate-900 border border-slate-800/60 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
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
              <span className="font-display font-semibold text-white text-sm tracking-tight text-left">Realtime Feed</span>
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
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-widest font-bold text-left">Active User</p>
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

        {/* Navigation lists wrappers */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          
          {/* CHANNELS SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 mb-1">
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

            <div className="space-y-1">
              {roomsLoading ? (
                <div className="space-y-2 p-2">
                  <div className="h-6 bg-slate-900/30 rounded-md animate-pulse" />
                  <div className="h-6 bg-slate-900/30 rounded-md animate-pulse" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <p className="text-[11px] text-slate-600 px-3 font-sans italic">No channels found</p>
              ) : (
                filteredRooms.map((room) => {
                  const isActive = activeRoom?.id === room.id && activeFriend === null;
                  return (
                    <button
                      key={room.id}
                      onClick={() => {
                        setActiveRoom(room);
                        setActiveFriend(null);
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
          </div>

          {/* PRIVATE MESSAGES / FRIENDS SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Direct Messages
                </span>
                {pendingReceivedRequests.length > 0 && (
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              <button
                onClick={() => {
                  if (dbSupport.hasPrivateDMsAndReplies) {
                    setShowFriendsModal(true);
                  } else {
                    alert("ميزات الأصدقاء والمراسلات الخاصة محجوبة لأن الجداول غير متواجدة في قاعدة البيانات حالياً. يرجى تشغيل السكريبت أولاً.");
                  }
                }}
                className="p-1 text-slate-500 hover:text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                title="Manage Friendships"
              >
                <Users className="w-3.5 h-3.5" />
                {dbSupport.hasPrivateDMsAndReplies && pendingReceivedRequests.length > 0 && (
                  <span className="text-[9px] text-red-400 font-bold font-mono">({pendingReceivedRequests.length})</span>
                )}
              </button>
            </div>

            <div className="space-y-1">
              {!dbSupport.hasPrivateDMsAndReplies ? (
                <div className="px-3 py-3 bg-slate-900/45 border border-slate-850/40 rounded-xl text-slate-450 text-[10.5px] leading-relaxed text-left">
                  <span className="text-amber-500 font-medium block mb-1">الرسائل الخاصة محجوبة 🔒</span>
                  قاعدة البيانات لا تدعم الجداول المضافة بعد. يرجى تطبيق سكريبت <code className="text-slate-300 font-mono text-[9px] bg-slate-950 px-1 py-0.5 rounded">supabase_setup_extension.sql</code> وتحديث الاتصال لتفعيلها.
                </div>
              ) : acceptedFriends.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-600 font-sans leading-relaxed text-left">
                  No private chats. Click the icon to find friends!
                </div>
              ) : (
                acceptedFriends.map((friend) => {
                  const isActive = activeFriend?.id === friend.id;
                  const isOnline = globalPresenceList.includes(friend.id);
                  const friendAvatar = friend.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`;

                  return (
                    <button
                      key={friend.id}
                      onClick={() => {
                        setActiveFriend(friend);
                        setActiveRoom(null);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-indigo-50 font-medium'
                          : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="relative shrink-0">
                          <img
                            src={friendAvatar}
                            alt={friend.username}
                            className="w-5 h-5 rounded-md object-contain p-0.5 bg-slate-800"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                        </div>
                        <span className="truncate">@{friend.username}</span>
                      </div>
                      <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest shrink-0">DM</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Live Pulse Panel representation from design */}
        <div className="p-4 mt-auto">
          <div className="bg-slate-900/80 border border-slate-800/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Pulse</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans text-left">
              Secure WebSocket Active. Messages, friend requests, and status indicators synchronized immediately.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full bg-[#09090B] font-sans relative overflow-hidden pl-0 md:pl-0">
        {(activeRoom || activeFriend) ? (
          <div className="h-full flex flex-col">
            {/* Header Area */}
            <div className="h-16 border-b border-slate-800/60 bg-[#09090B]/80 backdrop-blur-xl px-6 flex items-center justify-between relative z-10 pl-16 md:pl-6">
              <div className="flex items-center gap-4">
                <div className="flex flex-col text-left">
                  {activeRoom ? (
                    <>
                      <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                        <span className="text-slate-500 font-mono font-normal">#</span>
                        {activeRoom.name}
                      </h1>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        Public Channel Room
                      </span>
                    </>
                  ) : (
                    <>
                      <h1 className="text-base md:text-lg font-bold text-indigo-400 flex items-center gap-2 tracking-tight">
                        <span className="text-slate-500 font-mono font-normal">@</span>
                        {activeFriend?.username}
                      </h1>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        Private Chat Session
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Online Users Count Panel */}
              <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg shadow-sm">
                {activeRoom ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className={`w-2 h-2 rounded-full ${activeFriend && globalPresenceList.includes(activeFriend.id) ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                    <span className="text-xs font-mono font-medium text-slate-300">
                      {activeFriend && globalPresenceList.includes(activeFriend.id) ? 'Online' : 'Offline'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Database Fallback Alert Banner */}
            {!dbSupport.hasPrivateDMsAndReplies && (
              <div className="mx-6 mt-4 p-4 bg-amber-950/25 border border-amber-900/40 rounded-xl text-xs text-amber-200/80 flex flex-col gap-3 shadow-md">
                <div className="flex items-start gap-2.5 justify-between w-full">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-amber-950/40 border border-amber-900/40 rounded-lg text-amber-450 shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-white">الوضع الأساسي نشط حالياً (Basic Chat Mode Active) ⚠️</p>
                      <p className="text-[11px] text-slate-450 mt-1">
                        التطبيق متصل بـ <code className="text-cyan-400 font-mono text-[10px] bg-slate-950 border border-slate-900 px-1 py-0.5 rounded">{import.meta.env.VITE_SUPABASE_URL || 'الافتراضي'}</code>. لتفعيل ميزات الردود والرسائل الخاصة وقبول الأصدقاء، يرجى تشغيل ملف <code className="text-amber-400 font-mono font-semibold">supabase_setup.sql</code> بالكامل في الـ SQL Editor لمشروعك.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setMessagesLoading(true);
                      const ok = await checkDatabaseSchema();
                      fetchRooms();
                      if (ok) {
                        fetchFriendshipsAndProfiles();
                        alert("تم تحديث الفحص بنجاح! قاعدة البيانات الآن متزامنة بالكامل وبها المزايا المتقدمة.");
                      } else {
                        alert("لم يتم العثور على الأعمدة المحدثة بعد. يرجى التحقق من تطبيق الـ SQL في مشروع Supabase الخاص بك.");
                      }
                      setMessagesLoading(false);
                    }}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-lg font-medium transition-all shrink-0 cursor-pointer text-[11px]"
                  >
                    تحديث الاتصال (Retry)
                  </button>
                </div>
                {dbSupport.errorDetails && (
                  <div className="mt-1 p-2.5 bg-slate-950/80 border border-slate-900 rounded-lg text-left font-mono text-[10.5px] text-red-300 overflow-x-auto whitespace-pre-wrap">
                    <span className="text-slate-500 uppercase text-[9px] font-bold block mb-1">خطأ الاتصال الفعلي بقاعدة البيانات:</span>
                    {dbSupport.errorDetails}
                  </div>
                )}
              </div>
            )}

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
                  <h3 className="text-sm font-semibold text-white">Database Out of Sync</h3>
                  <p className="text-xs text-slate-400 mt-1 lines-spaced mb-4">
                    {messagesError}
                  </p>
                  <p className="text-xs text-cyan-400 bg-cyan-950/30 border border-cyan-900/30 px-3 py-2 rounded-lg font-mono">
                    Please apply the updated SQL schema extension using the 'supabase_setup_extension.sql' script inside your Supabase dashboard SQL editor.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 select-none">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-3">
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-xs">No messages yet. Send a message to start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* System Date Message */}
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-slate-800/50"></div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">
                      {activeRoom ? 'Channel Message Stream' : 'Secure Private DM Thread'}
                    </span>
                    <div className="flex-1 h-px bg-slate-800/50"></div>
                  </div>

                  {messages.map((msg) => {
                    const isCurrentUser = msg.user_id === userProfile.id;
                    const senderName = msg.profiles?.username || 'Anonymous';
                    const senderAvatar =
                      msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${senderName}`;

                    // Find if this message points to a reply
                    const parentMessage = msg.reply_to_message_id
                      ? messages.find((m) => m.id === msg.reply_to_message_id)
                      : null;

                    return (
                      <motion.div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex items-start gap-4 max-w-4xl group transition-all duration-200 p-1.5 rounded-xl ${
                          isCurrentUser ? 'flex-row-reverse self-end ml-auto' : 'text-left'
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

                        {/* Content Card container with reply anchor trigger */}
                        <div className={`flex flex-col gap-1 max-w-xs sm:max-w-md md:max-w-xl ${isCurrentUser ? 'items-end text-right' : 'items-start text-left'}`}>
                          
                          {/* Sender Info & Timestamp */}
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                              {isCurrentUser ? 'You' : `@${senderName}`}
                            </span>
                            <span className="text-[9px] text-slate-600 tracking-wider">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>

                          {/* Reply Quote preview bubble (if replying to another message) */}
                          {parentMessage && (
                            <button
                              onClick={() => jumpToMessage(parentMessage.id)}
                              className={`mb-1 p-2 text-xs rounded-lg border flex flex-col gap-0.5 text-left transition-colors text-ellipsis overflow-hidden shrink-0 ${
                                isCurrentUser
                                  ? 'bg-slate-900/80 hover:bg-slate-800 border-cyan-500/20 text-slate-400 border-r-2 border-r-cyan-500'
                                  : 'bg-slate-900/80 hover:bg-slate-800 border-indigo-500/20 text-slate-400 border-l-2 border-l-indigo-500'
                              }`}
                            >
                              <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-wide">
                                Replying to @{parentMessage.profiles?.username || 'user'}
                              </span>
                              <span className="line-clamp-1 italic text-slate-300">"{getMessagePreviewText(parentMessage.content)}"</span>
                            </button>
                          )}

                          {/* Message Body */}
                          <div className="relative group">
                            {(() => {
                              let isMedia = false;
                              let mediaType: 'image' | 'video' | 'audio' | null = null;
                              let mediaUrl = '';
                              let textContent = msg.content;

                              try {
                                if (msg.content.startsWith('{"type":"media"') || msg.content.includes('"media_type"')) {
                                  const parsed = JSON.parse(msg.content);
                                  if (parsed.type === 'media') {
                                    isMedia = true;
                                    mediaType = parsed.media_type;
                                    mediaUrl = parsed.url;
                                    textContent = parsed.text || '';
                                  }
                                }
                              } catch (e) {
                                // Fallback
                              }

                              return (
                                <div
                                  className={`px-4 py-3 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl flex flex-col gap-2 overflow-hidden ${
                                    isCurrentUser
                                      ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-tr-none shadow-[0_4px_20px_rgba(6,182,212,0.15)] text-left'
                                      : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none text-left'
                                  }`}
                                  style={{ minWidth: isMedia ? '200px' : 'auto' }}
                                >
                                  {isMedia && (
                                    <div className="rounded-xl overflow-hidden border border-white/5 bg-black/30 max-w-full max-h-[320px] flex flex-col justify-center items-center">
                                      {mediaType === 'image' && (
                                        <img
                                          src={mediaUrl}
                                          alt="Shared Media"
                                          className="max-w-full max-h-[260px] object-cover hover:scale-[1.01] cursor-zoom-in transition-all"
                                          onClick={() => window.open(mediaUrl, '_blank')}
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                      {mediaType === 'video' && (
                                        <video
                                          src={mediaUrl}
                                          controls
                                          preload="metadata"
                                          className="max-w-full max-h-[260px] rounded-lg"
                                        />
                                      )}
                                      {mediaType === 'audio' && (
                                        <div className="p-2 w-full max-w-[280px] min-w-[200px] bg-slate-950/25 rounded-lg flex items-center gap-2">
                                          <audio src={mediaUrl} controls className="w-full h-8 accent-cyan-500" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {(!isMedia || textContent) && (
                                    editingMessageId === msg.id ? (
                                      <div className="-m-1 p-1 bg-black/20 rounded-lg flex flex-col gap-1 w-full min-w-[200px]">
                                        <textarea
                                          autoFocus
                                          value={editingMessageText}
                                          onChange={(e) => setEditingMessageText(e.target.value)}
                                          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg resize-none focus:outline-hidden focus:border-cyan-500 font-sans"
                                          rows={2}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleUpdateMessage(msg.id, editingMessageText);
                                            }
                                            if (e.key === 'Escape') {
                                              setEditingMessageId(null);
                                            }
                                          }}
                                        />
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={() => setEditingMessageId(null)}
                                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-sm transition-colors cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleUpdateMessage(msg.id, editingMessageText)}
                                            className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] rounded-sm font-medium transition-colors cursor-pointer"
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap break-words leading-relaxed select-text">{textContent}</p>
                                    )
                                  )}
                                </div>
                              );
                            })()}

                            {/* Actions Overlay (only visible on row hover) */}
                            <div className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1.5 z-10 px-2 ${
                              isCurrentUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                            }`}>
                              {/* Reply Button (available to all) */}
                              <button
                                onClick={() => setReplyingToMessage(msg)}
                                className="p-1.5 bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 rounded-lg shadow-xl cursor-pointer transition-all shrink-0"
                                title="Reply to message"
                              >
                                <CornerUpLeft className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Button (only own messages) */}
                              {isCurrentUser && (
                                <button
                                  onClick={() => {
                                    setEditingMessageId(msg.id);
                                    let txt = msg.content;
                                    try {
                                      if (msg.content.startsWith('{"type":"media"') || msg.content.includes('"media_type"')) {
                                        const parsed = JSON.parse(msg.content);
                                        txt = parsed.text || '';
                                      }
                                    } catch {}
                                    setEditingMessageText(txt);
                                  }}
                                  className="p-1.5 bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-400 rounded-lg shadow-xl cursor-pointer transition-all shrink-0"
                                  title="Edit message"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Button (only own messages) */}
                              {isCurrentUser && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1.5 bg-slate-900/90 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg shadow-xl cursor-pointer transition-all shrink-0"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Reactions Pill Panel: 😂❤️😭🙂💔 */}
                              <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-800/90 p-1 rounded-lg shadow-xl shrink-0">
                                {['😂', '❤️', '😭', '🙂', '💔'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    className="hover:scale-130 active:scale-95 transition-transform cursor-pointer text-xs p-0.5 filter saturate-100"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Clustered Reactions Display list */}
                          {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              {(() => {
                                const groups: Record<string, typeof messageReactions[string]> = {};
                                (messageReactions[msg.id] || []).forEach((r) => {
                                  groups[r.emoji] = groups[r.emoji] || [];
                                  groups[r.emoji].push(r);
                                });

                                return Object.entries(groups).map(([emoji, rects]) => {
                                  const hasMyReaction = rects.some((r) => r.user_id === userProfile.id);
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => toggleReaction(msg.id, emoji)}
                                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all border cursor-pointer ${
                                        hasMyReaction
                                          ? 'bg-cyan-500/10 border-cyan-500/45 text-cyan-450 border-cyan-500/30'
                                          : 'bg-slate-950/80 border-slate-800/60 text-slate-400 hover:border-slate-700'
                                      }`}
                                      title={rects.map((r) => `@${r.username}`).join(', ')}
                                    >
                                      <span className="filter saturate-100">{emoji}</span>
                                      <span className="font-semibold">{rects.length}</span>
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}

                          {/* Delivered Tag */}
                          {isCurrentUser && (
                            <div className="flex items-center gap-1.5 mt-0.5 pr-1">
                              <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Delivered</span>
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

            {/* Input Form Footer with Reply Anchor bar & Emoji popover */}
            <div className="p-6 relative">
              
              {/* Replying quote mini banner */}
              <AnimatePresence>
                {replyingToMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-[calc(100%-8px)] left-6 right-6 bg-slate-900 border border-cyan-500/20 px-4 py-2 rounded-t-xl z-20 flex items-center justify-between shadow-2xl"
                  >
                    <div className="flex items-center gap-2 overflow-hidden text-left">
                      <CornerUpLeft className="w-4 h-4 text-cyan-500 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Replying to @{replyingToMessage.profiles?.username}</p>
                        <p className="text-xs text-slate-400 truncate max-w-md italic">"{getMessagePreviewText(replyingToMessage.content)}"</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 text-slate-500 hover:text-white rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Emoji popover picker */}
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute bottom-[80px] left-6 max-w-sm bg-[#0C0C0E] border border-slate-800 p-4 rounded-xl z-30 shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-850/40">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inject Expressions</span>
                      <button
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1.5 select-none font-sans">
                      {CHAT_EMOJIS.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePickEmoji(emoji)}
                          className="w-7 h-7 text-base rounded-md hover:bg-slate-800 flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Media Preview Attachment Banner */}
              {selectedMedia && (
                <div className="mx-6 mb-2.5 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-2xl relative z-10 animate-fade-in">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Media Thumbnail Preview */}
                    <div className="w-12 h-12 bg-black/40 rounded-lg border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {selectedMedia.type === 'image' && (
                        <img src={selectedMedia.dataUrl} alt="Upload" className="w-full h-full object-cover" />
                      )}
                      {selectedMedia.type === 'video' && (
                        <video src={selectedMedia.dataUrl} className="w-full h-full object-cover" muted />
                      )}
                      {selectedMedia.type === 'audio' && (
                        <Mic className="w-5 h-5 text-cyan-400 animate-pulse" />
                      )}
                    </div>
                    {/* Media details info */}
                    <div className="text-left overflow-hidden">
                      <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                        {selectedMedia.type === 'image' ? '📸 Attachment (صورة)' : selectedMedia.type === 'video' ? '🎥 Attachment (فيديو)' : '🎙️ Attachment (رسالة صوتية)'}
                      </p>
                      <p className="text-xs text-slate-300 truncate max-w-[140px] sm:max-w-xs">{selectedMedia.fileName || 'ملف ميديا'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedMedia.type === 'audio' && (
                      <audio src={selectedMedia.dataUrl} controls className="h-7 w-28 sm:w-44 accent-cyan-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedMedia(null)}
                      className="p-1.5 bg-slate-950 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg transition-all cursor-pointer shadow-md"
                      title="حذف المرفق"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Send Form */}
              <form onSubmit={handleSendMessage} className="bg-slate-900/60 border border-slate-800 p-2 rounded-2xl flex items-center gap-2 shadow-2xl relative z-10">
                
                {/* File Attachment input tag and trigger */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*"
                  className="hidden"
                />

                {/* Emoji toggle tool trigger */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`w-10 h-10 rounded-xl hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer ${
                    showEmojiPicker ? 'text-cyan-400 bg-slate-800/50' : 'text-slate-500 hover:text-white'
                  }`}
                  title="Insert emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* File Upload trigger button */}
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="إرفاق صورة أو فيديو"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Voice Recorder button */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isRecording 
                      ? 'bg-red-650/25 border border-red-500/30 text-red-500 hover:bg-red-600/40 animate-pulse' 
                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                  }`}
                  title={isRecording ? 'إيقاف وتسجيل الصوت' : 'تسجيل رسالة صوتية'}
                >
                  <Mic className="w-5 h-5" />
                </button>

                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between px-3 bg-red-950/25 border border-red-900/40 rounded-xl py-1.5 animate-pulse">
                    <span className="flex items-center gap-2 text-xs text-red-400 font-semibold font-sans">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      🎙️ جاري التسجيل... {formatRecordTime(recordingSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-1 transition-all text-[11px] font-bold cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>اتمام التسجيل</span>
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={
                      selectedMedia
                        ? "أكتب وصفاً للملف (اختياري)..."
                        : activeRoom 
                          ? `Message #${activeRoom.name}...` 
                          : `Whisper message to @${activeFriend?.username}...`
                    }
                    className="flex-1 bg-transparent border-hidden outline-hidden text-sm px-2 focus:outline-hidden focus:ring-0 text-slate-200 placeholder:text-slate-600 block animate-fade-in"
                    maxLength={1000}
                  />
                )}
                
                <button
                  type="submit"
                  disabled={(!newMessageText.trim() && !selectedMedia) || isRecording}
                  className="bg-cyan-600 hover:bg-cyan-500 w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all shadow-lg shadow-cyan-900/30 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              
              {/* Bottom live latency metadata metrics */}
              <div className="mt-2.5 flex items-center gap-4 pl-1">
                <div className="flex items-center gap-1.5 h-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse"></div>
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider italic">Channel WebSocket Secure Handshake Active</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty onboarding landing page */
          <div className="h-full flex flex-col items-center justify-center p-8 max-w-sm mx-auto text-center font-sans">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-900/20 mb-5 animate-pulse text-white">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Select Destination</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Choose a public channel room '#' from the listing folder, or open a private chat DM with your added friends to connect now in real-time.
            </p>
            <div className="flex flex-col gap-2 mt-6 w-full">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-cyan-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Public Room</span>
              </button>
              <button
                onClick={() => setShowFriendsModal(true)}
                className="px-4 py-2 bg-[#0C0C0E]/50 hover:bg-slate-900 border border-slate-850 text-indigo-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Users className="w-4 h-4" />
                <span>Manage Friends Center</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CREATE ROOM MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0C0C0E] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4 text-left">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-mono font-normal">#</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Channel</h3>
                  <p className="text-[10px] text-slate-500">Public rooms are open to everyone</p>
                </div>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4 text-left">
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
                    className="px-3.5 py-1.5 hover:bg-slate-800 text-slate-400 text-xs rounded-md transition-colors cursor-pointer"
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

      {/* FRIENDS CENTER MODAL */}
      <AnimatePresence>
        {showFriendsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0C0C0E] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col font-sans"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowFriendsModal(false);
                  setUserSearchQuery('');
                  setSearchedProfiles([]);
                }}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-850/40 shrink-0 text-left">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Friends Control Center</h3>
                  <p className="text-[10px] text-slate-500">Manage connections & start private chats</p>
                </div>
              </div>

              {/* Scrollable Panel Area */}
              <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1 text-left">
                
                {/* 1. FIND NEW FRIENDS SEARCH BAR */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connect with People</h4>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder="Type username to search directory..."
                      className="w-full bg-[#09090B] border border-slate-800 text-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-hidden focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Search Results */}
                  {userSearchQuery.trim() !== '' && (
                    <div className="bg-[#09090B] border border-slate-800/60 rounded-xl p-2 space-y-1.5">
                      {loadingSearch ? (
                        <p className="text-xs text-slate-500 p-2 italic animate-pulse">Searching the cloud registry...</p>
                      ) : searchedProfiles.length === 0 ? (
                        <p className="text-xs text-slate-600 p-2 italic">No profiles found matching "{userSearchQuery}"</p>
                      ) : (
                        searchedProfiles.map((prof) => {
                          // Find friendship status
                          const f = friendships.find(
                            (x) => x.sender_id === prof.id || x.receiver_id === prof.id
                          );
                          
                          let actionButton = null;

                          if (f) {
                            if (f.status === 'accepted') {
                              actionButton = (
                                <span className="text-[10px] bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                                  <UserCheck className="w-3.5 h-3.5" /> Already Friends
                                </span>
                              );
                            } else if (f.status === 'pending') {
                              if (f.sender_id === userProfile.id) {
                                actionButton = (
                                  <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-500 font-medium px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                                    Pending Sent
                                  </span>
                                );
                              } else {
                                actionButton = (
                                  <button
                                    onClick={() => handleAcceptRequest(f.id)}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-md transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" /> Accept Request
                                  </button>
                                );
                              }
                            }
                          } else {
                            actionButton = (
                              <button
                                onClick={() => handleSendRequest(prof.id)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-md transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Invite Friend
                              </button>
                            );
                          }

                          return (
                            <div key={prof.id} className="flex items-center justify-between gap-3 p-1.5 hover:bg-slate-900/50 rounded-lg">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <img
                                  src={prof.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${prof.username}`}
                                  alt={prof.username}
                                  className="w-8 h-8 rounded-lg bg-slate-800 object-contain p-0.5"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-xs font-semibold text-slate-100 truncate">@{prof.username}</span>
                              </div>
                              {actionButton}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 2. PENDING REQUESTS RECEIVED */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Incoming Request Alerts</span>
                    {pendingReceivedRequests.length > 0 && (
                      <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-1.5 rounded-full font-mono">
                        {pendingReceivedRequests.length}
                      </span>
                    )}
                  </h4>

                  {pendingReceivedRequests.length === 0 ? (
                    <p className="text-xs text-slate-600 italic pl-1 leading-relaxed">No pending requests waiting in your inbox.</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingReceivedRequests.map((req) => {
                        const senderProf = req.sender;
                        const senderName = senderProf?.username || 'user';
                        const senderAvatar = senderProf?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${senderName}`;

                        return (
                          <div key={req.id} className="flex items-center justify-between gap-4 p-2 bg-slate-900/40 border border-slate-850/60 rounded-xl">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <img src={senderAvatar} className="w-8 h-8 rounded-lg bg-slate-800 p-0.5" alt={senderName} referrerPolicy="no-referrer" />
                              <span className="text-xs font-semibold text-white">@{senderName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleAcceptRequest(req.id)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclineOrRemove(req.id)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded-md transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. VERIFIED FRIENDS DIRECTORY */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Friend Directory List</span>
                    <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 font-bold px-1.5 rounded-full font-mono">
                      {acceptedFriends.length}
                    </span>
                  </h4>

                  {acceptedFriends.length === 0 ? (
                    <p className="text-xs text-slate-600 italic pl-1 leading-relaxed">Your directory is empty. Use the search field above to make connections.</p>
                  ) : (
                    <div className="space-y-2">
                      {friendships
                        .filter((f) => f.status === 'accepted')
                        .map((f) => {
                          const friend = f.sender_id === userProfile.id ? f.receiver : f.sender;
                          if (!friend) return null;

                          const isOnline = globalPresenceList.includes(friend.id);
                          const friendAvatar = friend.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`;

                          return (
                            <div key={f.id} className="flex items-center justify-between gap-4 p-2 hover:bg-slate-900/30 rounded-xl transition-all border border-slate-850/20">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="relative shrink-0">
                                  <img src={friendAvatar} className="w-8 h-8 rounded-lg bg-slate-800 object-contain p-0.5" alt={friend.username} referrerPolicy="no-referrer" />
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-semibold text-white truncate">@{friend.username}</p>
                                  <p className="text-[9px] text-slate-500 font-mono tracking-tighter">
                                    {isOnline ? 'Online now' : 'Currently offline'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setActiveFriend(friend);
                                    setActiveRoom(null);
                                    setShowFriendsModal(false);
                                    setShowMobileSidebar(false);
                                  }}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
                                  title="Start Direct Chat Session"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeclineOrRemove(f.id)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-red-500 rounded-lg hover:border-red-500/30 transition-all cursor-pointer"
                                  title="Unfriend/Disconnect"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
