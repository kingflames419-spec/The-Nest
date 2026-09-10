import { useState, FormEvent, useRef } from 'react';
import { Camera, Loader2, ArrowRight, UserRound, Hexagon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/chat/Avatar';

export function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [preview, setPreview] = useState(profile?.avatar_url ?? '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setError(null);
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      setError('Could not upload that image. You can continue without one.');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setPreview(data.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), avatar_url: avatarUrl || null })
      .eq('id', user.id);
    setLoading(false);
    if (updateError) {
      setError('Could not save your profile. Please try again.');
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="min-h-screen honeycomb-pattern flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-nest-honey/5 blur-[120px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10 glass-overlay hairline-bright rounded-2xl p-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 hex-clip bg-nest-carbon hairline flex items-center justify-center">
            <Hexagon className="w-5 h-5 text-nest-honey" />
          </div>
          <div>
            <h1 className="font-display text-headline-sm text-nest-white">Build your profile</h1>
            <p className="text-body-sm text-nest-zinc">Make yourself at home in The Nest</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative group">
              <Avatar src={preview} name={name} size="xl" />
              <span className="absolute inset-0 hex-clip bg-nest-void/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? <Loader2 className="w-6 h-6 text-nest-honey animate-spin" /> : <Camera className="w-6 h-6 text-nest-white" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <p className="text-center text-label-md text-nest-zinc-dim uppercase tracking-wider">Profile photo optional</p>

          <div>
            <label className="block text-label-md text-nest-zinc-dim uppercase tracking-wider mb-2">Display name</label>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-nest-zinc-dim" />
              <input type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="How should friends call you?" className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input hairline text-nest-white outline-none transition-all focus:border-nest-honey/50 focus:ring-1 focus:ring-nest-honey/30 placeholder:text-nest-zinc-dim" />
            </div>
          </div>
          {error && <p className="text-body-sm text-nest-error bg-nest-error-container/20 rounded-lg px-3 py-2 border border-nest-error/30">{error}</p>}
          <button type="submit" disabled={loading || !name.trim() || uploading} className="w-full bg-nest-honey hover:bg-nest-honey-dim disabled:opacity-50 text-nest-void font-display font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 honey-glow">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Enter The Nest <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
