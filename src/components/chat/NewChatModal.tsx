import { useEffect, useState } from 'react';
import { X, Search, Users, Loader2, Hexagon, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types';
import { Avatar } from './Avatar';

interface Props { mode: 'direct' | 'group'; onClose: () => void; onCreated: (id: string) => void; }

export function NewChatModal({ mode, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { supabase.from('profiles').select('*').neq('id', user?.id ?? '').order('display_name').then(({ data }) => setProfiles((data ?? []) as Profile[])); }, [user?.id]);
  const shown = profiles.filter((p) => `${p.display_name ?? ''} ${p.email}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (p: Profile) => setSelected((current) => current.some((x) => x.id === p.id) ? current.filter((x) => x.id !== p.id) : [...current, p]);
  const create = async () => { if (!user || selected.length === 0 || (mode === 'group' && !name.trim())) return; setLoading(true); const { data, error } = mode === 'direct' ? await supabase.rpc('find_or_create_direct_conversation', { p_other_user_id: selected[0].id }) : await supabase.rpc('create_group_conversation', { p_name: name.trim(), p_member_ids: selected.map((p) => p.id) }); setLoading(false); if (!error && data) onCreated(data as string); };
  return <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}><div className="glass-overlay hairline-bright w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl honey-glow-strong max-h-[85vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
    <div className="p-5 hairline-b flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 hex-clip bg-nest-carbon hairline flex items-center justify-center"><Users className="w-5 h-5 text-nest-honey" /></div><div><h2 className="font-display text-headline-sm text-nest-white">{mode === 'group' ? 'New family room' : 'New conversation'}</h2><p className="text-body-sm text-nest-zinc-dim">{mode === 'group' ? 'Invite your inner circle' : 'Choose someone to message'}</p></div></div><button onClick={onClose} className="p-2 rounded-lg text-nest-zinc hover:text-nest-white hover:bg-nest-slate"><X className="w-5 h-5" /></button></div>
    <div className="p-4 space-y-3">{mode === 'group' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your room" className="w-full px-4 py-3 rounded-xl glass-input hairline text-body-md text-nest-white outline-none focus:border-nest-honey/40 placeholder:text-nest-zinc-dim" />}<div className="relative"><Search className="w-4 h-4 text-nest-zinc-dim absolute left-3.5 top-1/2 -translate-y-1/2" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people in The Nest" className="w-full pl-10 pr-3 py-3 rounded-xl glass-input hairline text-body-md text-nest-white outline-none focus:border-nest-honey/40 placeholder:text-nest-zinc-dim" /></div></div>
    <div className="overflow-y-auto px-4 pb-4 space-y-1">{shown.length === 0 ? <div className="text-center py-10"><Hexagon className="w-8 h-8 text-nest-zinc-dim mx-auto mb-2" /><p className="text-body-sm text-nest-zinc">No one found</p></div> : shown.map((p) => <button key={p.id} onClick={() => mode === 'direct' ? (setSelected([p]), setTimeout(create, 0)) : toggle(p)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${selected.some((x) => x.id === p.id) ? 'bg-nest-graphite hairline' : 'hover:bg-nest-slate'}`}><Avatar src={p.avatar_url} name={p.display_name} size="sm" online /><div className="min-w-0 flex-1"><p className="font-display text-body-md text-nest-white-soft truncate">{p.display_name || 'New friend'}</p><p className="text-body-sm text-nest-zinc-dim truncate">{p.email}</p></div>{mode === 'group' && <span className={`w-5 h-5 hex-badge flex items-center justify-center ${selected.some((x) => x.id === p.id) ? 'bg-nest-honey text-nest-void' : 'hairline text-transparent'}`}><Check className="w-3 h-3" /></span>}</button>)}</div>
    {mode === 'group' && <div className="p-4 hairline-t"><button disabled={loading || selected.length === 0 || !name.trim()} onClick={create} className="w-full bg-nest-honey hover:bg-nest-honey-dim disabled:opacity-40 text-nest-void py-3 rounded-xl font-display font-semibold flex justify-center items-center honey-glow">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Create room${selected.length ? ` with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}` : ''}`}</button></div>}
  </div></div>;
}
