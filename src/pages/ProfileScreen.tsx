import { useState } from 'react';
import { ArrowLeft, Camera, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Profile } from '../types/app';
import { appAvatars, getAppAvatar } from '../data/avatars';

interface ProfileScreenProps {
  profile: Profile;
  onBack: () => void;
  onUpdate: (next: Profile) => void;
}

export function ProfileScreen({ profile, onBack, onUpdate }: ProfileScreenProps) {
  const [draft, setDraft] = useState<Profile>(profile);

  const updateField = (field: keyof Profile, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    onUpdate(draft);
    onBack();
  };

  return (
    <section className="flex h-full flex-col bg-[#f5f2fb]">
      <header className="flex items-center justify-between gap-3 border-b border-violet-100 bg-white px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">Profile</p>
          <h1 className="text-xl font-bold text-slate-900">Manage profile</h1>
        </div>
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
        >
          Save
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={getAppAvatar(draft.avatarId).src}
                alt="Profile avatar"
                className="h-20 w-20 rounded-full border-2 border-violet-200 object-cover shadow-md"
              />
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-violet-200 bg-violet-600 text-white shadow-md"
                aria-label="Update avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-slate-900">{draft.name}</p>
              <p className="text-sm text-slate-500">{draft.role} · {draft.fafId}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-violet-700">
            <UserRound className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Identity</h2>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                value={draft.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none focus:border-violet-500"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Choose an app avatar</legend>
              <div className="mt-2 flex gap-3">
                {appAvatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    aria-label={`Use ${avatar.label} avatar`}
                    aria-pressed={draft.avatarId === avatar.id}
                    onClick={() => setDraft((prev) => ({ ...prev, avatarId: avatar.id }))}
                    className={`rounded-full p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${draft.avatarId === avatar.id ? 'bg-violet-700' : 'bg-transparent'}`}
                  >
                    <img src={avatar.src} alt="" className="h-12 w-12 rounded-full" />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-violet-700">
            <Mail className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Contact</h2>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              FaF ID
              <input
                value={draft.fafId}
                onChange={(e) => updateField('fafId', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-slate-800 outline-none focus:border-violet-500"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                value={draft.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none focus:border-violet-500"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Number
              <input
                value={draft.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none focus:border-violet-500"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Address
              <textarea
                value={draft.address}
                onChange={(e) => updateField('address', e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none focus:border-violet-500"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-violet-700">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Account</h2>
          </div>

          <div className="space-y-4 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-violet-700" />
                Post / Feeds
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">Read only</span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-violet-700" />
                Location sharing
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
