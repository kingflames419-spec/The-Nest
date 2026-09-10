import { useEffect, useState, useCallback } from 'react';
import { MessageCirclePlus, UsersRound, LogOut, Search, Settings2, Bell, Hexagon, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ConversationListItem } from '@/types';
import { Avatar } from './Avatar';

interface Props { selectedId: string | null; onSelect: (id: string) => void; onNew: (mode: 'direct' | 'group') => void; }

export function ChatList({ selectedId, onSelect, onNew }: Props) {
  const { user, profile, signOut } = useAuth();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_conversation_list', { p_user_id: user.id });
    setItems((data ?? []) as ConversationListItem[]);
  }, [user]);
  useEffect(() => {
    load();
    const channel = supabase.channel(`conversation-list-${user?.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user?.id]);
  const filtered = items.filter((item) => (item.conv_type === 'group' ? item.conv_name : item.other_user_display_name || item.other_user_email)?.toLowerCase().includes(query.toLowerCase()));
  const title = (item: ConversationListItem) => item.conv_type === 'group' ? item.conv_name || 'Family room' : item.other_user_display_name || item.other_user_email || 'New conversation';
  return (
    <aside className="w-full md:w-[360px] lg:w-[400px] shrink-0 bg-nest-void hairline-r flex flex-col h-full honeycomb-bg">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 hex-clip bg-nest-carbon hairline flex items-center justify-center shrink-0"><Hexagon className="w-5 h-5 text-nest-honey" /></div>
            <div className="min-w-0"><p className="font-display text-headline-sm text-nest-white truncate">The Nest</p><p className="text-label-sm text-nest-zinc-dim uppercase tracking-wider">Private circle</p></div>
          </div>
          <div className="flex gap-0.5">
            <button onClick={() => onNew('group')} title="New family room" className="p-2.5 rounded-lg text-nest-zinc hover:text-nest-honey hover:bg-nest-slate transition-colors"><UsersRound className="w-[18px] h-[18px]" /></button>
            <button onClick={() => onNew('direct')} title="New chat" className="p-2.5 rounded-lg text-nest-zinc hover:text-nest-honey hover:bg-nest-slate transition-colors"><MessageCirclePlus className="w-[18px] h-[18px]" /></button>
            <button onClick={signOut} title="Sign out" className="p-2.5 rounded-lg text-nest-zinc hover:text-nest-white hover:bg-nest-slate transition-colors"><LogOut className="w-[18px] h-[18px]" /></button>
          </div>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nest-zinc-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the nest" className="w-full pl-10 pr-4 py-3 rounded-full glass-input hairline text-body-sm text-nest-white outline-none focus:border-nest-honey/40 placeholder:text-nest-zinc-dim transition-all" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-nest-graphite hairline text-label-md text-nest-white"><span className="w-1.5 h-1.5 bg-nest-honey rounded-full" /> All</button>
          <button className="shrink-0 px-3 py-1.5 rounded-full bg-nest-slate hairline text-label-md text-nest-zinc">Unread</button>
          <button className="shrink-0 px-3 py-1.5 rounded-full bg-nest-slate hairline text-label-md text-nest-zinc">Family</button>
        </div>
      </div>
      <div className="px-5 py-3 flex items-center justify-between hairline-t"><p className="text-label-md text-nest-zinc-dim uppercase tracking-wider">Your conversations</p><SlidersHorizontal className="w-4 h-4 text-nest-zinc-dim" /></div>
      <div className="flex-1 overflow-y-auto px-3 pb-5">
        {filtered.length === 0 ? <div className="py-20 text-center px-6"><div className="w-14 h-14 hex-clip bg-nest-carbon hairline mx-auto mb-4 flex items-center justify-center"><Bell className="w-6 h-6 text-nest-honey/70" /></div><p className="font-display text-headline-sm text-nest-white-soft">Your nest is quiet</p><p className="text-body-sm text-nest-zinc-dim mt-2">Start a new conversation to bring people in.</p></div> : filtered.map((item) => <button key={item.conversation_id} onClick={() => onSelect(item.conversation_id)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all mb-1 ${selectedId === item.conversation_id ? 'bg-nest-graphite hairline-bright honey-glow' : 'hover:bg-nest-slate'}`}><Avatar src={item.conv_type === 'group' ? item.conv_avatar_url : item.other_user_avatar_url} name={title(item)} size="md" online={item.conv_type === 'direct'} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-display text-body-md text-nest-white-soft truncate">{title(item)}</p>{item.last_message_created_at && <span className="text-label-sm text-nest-zinc-dim shrink-0">{new Date(item.last_message_created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}</div><div className="flex items-center justify-between gap-2 mt-0.5"><p className="text-body-sm text-nest-zinc truncate">{item.last_message_body || 'Start a conversation'}</p>{item.unread_count > 0 && <span className="min-w-5 h-5 px-1.5 hex-badge bg-nest-honey text-nest-void text-label-sm flex items-center justify-center">{item.unread_count}</span>}</div></div></button>)}
      </div>
      <div className="p-4 hairline-t flex items-center gap-3"><Avatar src={profile?.avatar_url} name={profile?.display_name} size="sm" online /><div className="min-w-0 flex-1"><p className="font-display text-body-md text-nest-white-soft truncate">{profile?.display_name || 'Welcome'}</p><p className="text-label-sm text-nest-zinc-dim uppercase tracking-wider">Your profile</p></div><Settings2 className="w-4 h-4 text-nest-zinc-dim" /></div>
    </aside>
  );
}
