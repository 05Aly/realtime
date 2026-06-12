export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  updated_at: string;
}

export interface Room {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface Message {
  id: string;
  room_id: string | null;
  user_id: string;
  recipient_id?: string | null;
  reply_to_message_id?: string | null;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender?: Profile | null;
  receiver?: Profile | null;
}

export interface PresenceUser {
  user_id: string;
  username: string;
  avatar_url: string;
  online_at: string;
}
