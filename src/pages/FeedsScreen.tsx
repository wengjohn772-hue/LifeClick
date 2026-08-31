import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUpIcon, RecycleIcon, PlusIcon } from 'lucide-react';
import { posts } from '../data/posts';
import { getAppAvatar } from '../data/avatars';
import { Post } from '../types/app';

const tagStyles: Record<Post['tag'], string> = {
  Alert: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  Update: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Resolved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Notice: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export function FeedsScreen() {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [reposted, setReposted] = useState<Record<string, boolean>>({});

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string) =>
    setter((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="flex h-full flex-col bg-[#f8f4ff] dark:bg-slate-950">
      <header className="flex items-center justify-between gap-4 px-5 pb-3 pt-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Feeds</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Community updates from around the city.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Post
        </button>
      </header>

      <ul className="flex-1 space-y-3 overflow-y-auto px-4 pb-5">
        {posts.map((post) => {
          const isLiked = Boolean(liked[post.id]);
          const isReposted = Boolean(reposted[post.id]);

          return (
            <li key={post.id}>
              <article className="overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-[0_12px_24px_rgba(109,40,217,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2.5 p-4">
                  <img src={getAppAvatar(post.avatarId).src} alt="App avatar" className="h-10 w-10 rounded-full object-cover ring-2 ring-violet-100" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{post.userId}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{post.area} · {post.timeAgo}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tagStyles[post.tag]}`}>
                    {post.tag}
                  </span>
                </div>

                <div className="px-4 pb-3">
                  <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{post.body}</p>

                  {post.image && (
                    <img
                      src={post.image}
                      alt={post.area}
                      className="mt-3 h-52 w-full rounded-2xl object-cover"
                    />
                  )}
                </div>

                <div className="flex items-center gap-1 border-t border-violet-100 px-4 py-3 dark:border-white/10">
                  <motion.button
                    type="button"
                    onClick={() => toggle(setLiked, post.id)}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
                    aria-pressed={isLiked}
                    aria-label={`Like post from ${post.area}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                      isLiked ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <ThumbsUpIcon className="h-4 w-4" strokeWidth={isLiked ? 2.25 : 1.75} aria-hidden="true" />
                    {post.likes + (isLiked ? 1 : 0)}
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => toggle(setReposted, post.id)}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
                    aria-pressed={isReposted}
                    aria-label={`Repost from ${post.area}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                      isReposted ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <RecycleIcon className="h-4 w-4" strokeWidth={isReposted ? 2.25 : 1.75} aria-hidden="true" />
                    {post.reposts + (isReposted ? 1 : 0)}
                  </motion.button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}