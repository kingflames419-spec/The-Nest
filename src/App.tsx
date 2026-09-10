import { useState } from 'react';
import { Hexagon, LockKeyhole } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { ProfileSetup } from '@/components/auth/ProfileSetup';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { NewChatModal } from '@/components/chat/NewChatModal';
import type { ConversationListItem } from '@/types';
import { supabase } from '@/lib/supabase';

function MessagingApp() {
  const { session, profile, loading } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<'direct' | 'group' | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<ConversationListItem | undefined>();
  if (loading) return <div className="min-h-screen bg-nest-void flex items-center justify-center honeycomb-pattern"><div className="w-10 h-10 hex-clip bg-nest-carbon flex items-center justify-center"><Hexagon className="w-5 h-5 text-nest-honey animate-pulse" /></div></div>;
  if (!session) return <AuthScreen />;
  if (!profile?.display_name) return <ProfileSetup />;
  const open = async (id: string) => { setSelectedId(id); const { data } = await supabase.rpc('get_conversation_list', { p_user_id: session.user.id }); setSelectedSummary((data as ConversationListItem[] | null)?.find((item) => item.conversation_id === id)); };
  return <div className="h-screen overflow-hidden bg-nest-void flex"><div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-auto`}><ChatList selectedId={selectedId} onSelect={open} onNew={setModal} /></div>{selectedId ? <ChatWindow conversationId={selectedId} summary={selectedSummary} onBack={() => setSelectedId(null)} /> : <div className="hidden md:flex flex-1 items-center justify-center honeycomb-pattern"><div className="text-center max-w-sm px-6"><div className="w-20 h-20 hex-clip bg-nest-carbon hairline-bright mx-auto mb-6 flex items-center justify-center honey-glow"><Hexagon className="w-9 h-9 text-nest-honey" strokeWidth={1.5} /></div><h2 className="font-display text-display-lg text-nest-white">Welcome to The Nest</h2><p className="text-body-lg text-nest-zinc mt-3">A private place for the people who matter most.</p><div className="flex items-center justify-center gap-2 mt-6"><LockKeyhole className="w-3.5 h-3.5 text-nest-honey" /><span className="text-label-md text-nest-zinc-dim uppercase tracking-wider">Your conversations stay yours</span></div></div></div>}{modal && <NewChatModal mode={modal} onClose={() => setModal(null)} onCreated={(id) => { setModal(null); open(id); }} />}</div>;
}

export default function App() { return <AuthProvider><MessagingApp /></AuthProvider>; }
