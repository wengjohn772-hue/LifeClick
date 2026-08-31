export interface AppAvatar {
  id: string;
  label: string;
  src: string;
}

const makeAvatar = (background: string, accent: string, initials: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="${background}"/><circle cx="80" cy="62" r="28" fill="${accent}"/><path d="M35 137c5-30 23-45 45-45s40 15 45 45" fill="${accent}"/><text x="80" y="151" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="white">${initials}</text></svg>`)}`;

export const appAvatars: AppAvatar[] = [
  { id: 'violet', label: 'Violet', src: makeAvatar('#6d28d9', '#ddd6fe', 'V') },
  { id: 'coral', label: 'Coral', src: makeAvatar('#be123c', '#fecdd3', 'C') },
  { id: 'teal', label: 'Teal', src: makeAvatar('#0f766e', '#99f6e4', 'T') },
  { id: 'amber', label: 'Amber', src: makeAvatar('#b45309', '#fde68a', 'A') },
];

export const getAppAvatar = (avatarId: string) =>
  appAvatars.find((avatar) => avatar.id === avatarId) ?? appAvatars[0];
