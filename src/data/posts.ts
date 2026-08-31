import { Post } from '../types/app';

export const posts: Post[] = [
  {
    id: 'p1',
    userId: 'user-7F42',
    avatarId: 'violet',
    timeAgo: '4m',
    area: 'Riverside Dr.',
    body: 'Streetlights are out along the whole stretch past the bridge. A small walking group is forming by the corner shop around 9pm if anyone is heading that way.',
    tag: 'Notice',
    likes: 42,
    reposts: 11,
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'p2',
    userId: 'user-3K91',
    avatarId: 'teal',
    timeAgo: '22m',
    area: 'Market Square',
    body: 'Two attempted phone snatches near the taxi rank this evening. Keep devices out of sight while waiting and let other residents know.',
    tag: 'Alert',
    likes: 168,
    reposts: 87,
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'p3',
    userId: 'user-8M16',
    avatarId: 'coral',
    timeAgo: '1h',
    area: 'Campus North',
    body: 'The missing student reported this morning has been found safe and is back home. Thank you to everyone who reposted and checked in.',
    tag: 'Resolved',
    likes: 512,
    reposts: 203,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'p4',
    userId: 'user-5Q28',
    avatarId: 'amber',
    timeAgo: '3h',
    area: 'Hillview',
    body: 'Road closed at the junction due to a burst pipe. Detour via Second Ave is adding about 15 minutes, so plan ahead if you are nearby.',
    tag: 'Update',
    likes: 76,
    reposts: 24,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
  }
];