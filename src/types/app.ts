export type TabId = 'map' | 'clicker' | 'faf' | 'feeds' | 'settings';

export interface Post {
  id: string;
  userId: string;
  avatarId: string;
  timeAgo: string;
  area: string;
  body: string;
  tag: 'Alert' | 'Update' | 'Resolved' | 'Notice';
  likes: number;
  reposts: number;
  image?: string;
}

export interface Friend {
  id: string;
  fafId: string;
  alias: string;
  distance: string;
  status: 'safe' | 'stale';
}

export interface TrustedContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
}

export interface Profile {
  name: string;
  fafId: string;
  email: string;
  phone: string;
  address: string;
  avatarId: string;
  role: string;
  postsEnabled: boolean;
  feedsEnabled: boolean;
}