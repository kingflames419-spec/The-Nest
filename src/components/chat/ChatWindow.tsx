import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, Check, CheckCheck, ChevronDown, Loader2, MoreVertical, Paperclip, Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';
import type { ConversationListItem, Message } from '@/types';
import { Avatar } from './Avatar';
import { browserNotificationsAvailable, notifyAboutMessage, requestBrowserNotifications } from '@/lib/notifications';

interface Props { conversationId: string; summary: ConversationListItem | undefined; onBack: () => void; }
const PAGE_SIZE = 50;

export function ChatWindow({ conversationId, summary, onBack }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [otherMemberOnline, setOtherMemberOnline] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => browserNotificationsAvailable() ? Notification.permission : 'unsupported');
  const [typing, setTyping] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const title = summary?.conv_type === 'group' ? summary.conv_name || 'Family room' : summary?.other_user_display_name || summary?.other_user_email || 'Conversation';
  const avatar = summary?.conv_type === 'group' ? summary.conv_avatar_url : summary?.other_user_avatar_url;

  const mergeMessage = useCallback((message: Message) => {
    if (message.sender_id !== user?.id) notifyAboutMessage(title, message.body, `message-${message.conversation_id}`);
    setMessages((current) => current.some((item) => item.id === message.id)
      ? current.map((item) => item.id === message.id ? { ...message, client_status: 'sent' as const } : item)
      : [...current, { ...message, client_status: 'sent' as const }].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, [title, user?.id]);

  const loadLatest = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(PAGE_SIZE);
    const loaded = ((data ?? []) as Message[]).reverse().map((message) => ({ ...message, client_status: 'sent' as const }));
    setMessages(loaded);
    setHasMore(loaded.length === PAGE_SIZE);
  }, [conversationId]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE_SIZE);
    const loaded = ((data ?? []) as Message[]).reverse().map((message) => ({ ...message, client_status: 'sent' as const }));
    setMessages((current) => [...loaded, ...current]);
    setHasMore(loaded.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  useEffect(() => {
    setMessages([]);
    setConnection('connecting');
    void loadLatest();
    const updatePresence = (channel: RealtimeChannel) => {
      const peers = Object.values(channel.presenceState<{ userId: string }>()).flat();
      setOtherMemberOnline(peers.some((peer) => peer.userId !== user?.id));
    };
    const channel = supabase.channel(`conversation-${conversationId}`, { config: { presence: { key: user?.id } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => mergeMessage(payload.new as Message))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user?.id) {
          setTyping(Boolean(payload.active));
          window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setTyping(false), 2500);
        }
      })
      .on('presence', { event: 'sync' }, () => updatePresence(channel))
      .on('presence', { event: 'join' }, () => updatePresence(channel))
      .on('presence', { event: 'leave' }, () => updatePresence(channel))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { channelRef.current = channel; void channel.track({ userId: user?.id }); setConnection('live'); void loadLatest(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnection('reconnecting');
      });
    supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', user?.id ?? '');
    const offline = () => setConnection('reconnecting');
    const online = () => setConnection('connecting');
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => { window.clearTimeout(typingTimer.current); channelRef.current = null; window.removeEventListener('offline', offline); window.removeEventListener('online', online); supabase.removeChannel(channel); };
  }, [conversationId, loadLatest, mergeMessage, user?.id]);

  const send = async () => {
    const text = body.trim();
    if (!text || !user) return;
    const id = crypto.randomUUID();
    const message: Message = { id, conversation_id: conversationId, sender_id: user.id, body: text, created_at: new Date().toISOString(), delivered_at: null, client_status: 'sending' };
    setMessages((current) => [...current, message]);
    setBody('');
    const { error } = await supabase.from('messages').insert({ ...message, client_status: undefined });
    setMessages((current) => current.map((item) => item.id === id ? { ...item, client_status: error ? 'failed' : 'sent' } : item));
  };

  const notifyTyping = () => {
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, active: true } });
  };

  useEffect(() => { if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  return <section className="flex-1 min-w-0 flex flex-col h-full bg-nest-abyss honeycomb-pattern">
    <header className="h-[76px] px-4 md:px-6 glass hairline-b specular-top flex items-center gap-3 shrink-0">
      <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full text-nest-zinc hover:text-nest-white hover:bg-nest-slate"><ArrowLeft className="w-5 h-5" /></button>
      <Avatar src={avatar} name={title} size="md" online={otherMemberOnline} />
      <div className="min-w-0 flex-1"><h2 className="font-display text-headline-sm text-nest-white truncate">{title}</h2><p className="text-label-md text-nest-zinc-dim flex items-center gap-1.5 mt-0.5">{summary?.conv_type === 'group' ? <><Users className="w-3 h-3" /> {summary.member_count} members</> : connection === 'live' ? otherMemberOnline ? 'Online' : 'Offline' : 'Reconnecting…'}</p></div>
      {notificationPermission === 'default' && <button onClick={() => void requestBrowserNotifications().then(setNotificationPermission)} title="Enable notifications" className="p-2.5 rounded-lg text-nest-zinc hover:text-nest-white hover:bg-nest-slate"><Bell className="w-5 h-5" /></button>}
      <button className="p-2.5 rounded-lg text-nest-zinc hover:text-nest-white hover:bg-nest-slate"><MoreVertical className="w-5 h-5" /></button>
    </header>
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2" onScroll={(event) => { if (event.currentTarget.scrollTop < 80) void loadOlder(); }}>
      {hasMore && <button onClick={() => void loadOlder()} disabled={loadingMore} className="mx-auto flex items-center gap-1 text-label-md text-nest-zinc hover:text-nest-white disabled:opacity-50">{loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 rotate-180" />} Load earlier messages</button>}
      {messages.map((message) => { const own = message.sender_id === user?.id; return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'} animate-slide-up`}><div className={`max-w-[82%] sm:max-w-[65%] px-4 py-2.5 ${own ? 'bubble-outgoing rounded-[18px] rounded-br-[4px]' : 'bubble-incoming rounded-[18px] rounded-bl-[4px]'}`}><p className="text-body-lg text-nest-white-soft whitespace-pre-wrap break-words">{message.body}</p><div className="flex items-center justify-end gap-1.5 mt-1"><span className="text-label-sm text-nest-zinc-dim">{message.client_status === 'failed' ? 'Not sent' : message.client_status === 'sending' ? 'Sending…' : new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>{own && (message.client_status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-nest-zinc-dim" /> : message.delivered_at ? <CheckCheck className="w-3.5 h-3.5 text-nest-honey" /> : <Check className="w-3.5 h-3.5 text-nest-zinc-dim" />)}</div></div></div>; })}
      {typing && <p className="text-body-sm text-nest-zinc italic px-2">{title} is typing…</p>}<div ref={endRef} />
    </div>
    <div className="px-3 md:px-6 pb-4 pt-2 shrink-0"><div className="max-w-4xl mx-auto flex items-center gap-2 glass-input hairline-bright rounded-2xl px-2 py-2 specular-top"><button className="p-2 text-nest-zinc hover:text-nest-honey transition-colors" aria-label="Attach a file"><Paperclip className="w-5 h-5" /></button><input value={body} onChange={(event) => { setBody(event.target.value); notifyTyping(); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Write a message..." className="flex-1 bg-transparent px-2 py-2 text-body-md text-nest-white outline-none placeholder:text-nest-zinc-dim" /><button onClick={() => void send()} disabled={!body.trim()} className="w-10 h-10 rounded-xl bg-nest-honey hover:bg-nest-honey-dim disabled:opacity-30 text-nest-void flex items-center justify-center transition-all honey-glow"><Send className="w-4 h-4" /></button></div></div>
  </section>;
}
