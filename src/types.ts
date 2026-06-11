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
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface PresenceUser {
  user_id: string;
  username: string;
  avatar_url: string;
  online_at: string;
}
