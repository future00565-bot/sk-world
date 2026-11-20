import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  Flag,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { apiUrl } from '../lib/apiBase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRelativeTime } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import {
  createGroupConversation,
  fetchAllActiveUsers,
  getOrCreateDirectConversation,
  markMessageRead,
  sendChatMessage,
} from '../services/skworldService';
import type { ChatMessageItem, ConversationItem, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { ReportModal } from '../components/ReportModal';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];

export const MessagesPage: React.FC = () => {
  const { profile, firebaseUser, getIdToken } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeen: number | null }>>({});
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get('c'));
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ uid: string; name: string }>>([]);
  const [convSearch, setConvSearch] = useState('');

  // Composer & Actions
  const [text, setText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'none' | 'image' | 'video' | 'file'>('none');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessageItem | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);

  // Load user directory
  useEffect(() => {
    fetchAllActiveUsers(80)
      .then((list) => {
        const map: Record<string, UserProfile> = {};
        list.forEach((u) => {
          map[u.uid] = u;
        });
        setUsersMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const paramConv = searchParams.get('c');
    if (paramConv) {
      setActiveConvId(paramConv);
    }
  }, [searchParams]);

  // Real-time conversations listener
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ConversationItem, 'id'>) }))
          .sort((a, b) => {
            const ta = (a.updatedAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
            const tb = (b.updatedAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
            return tb - ta;
          });
        setConversations(list);
        if (!activeConvId && list.length > 0) {
          setActiveConvId(list[0].id);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'conversations');
      }
    );
    return () => unsub();
  }, [firebaseUser, activeConvId]);

  // Real-time messages for active conversation
  useEffect(() => {
    if (!activeConvId || !firebaseUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', activeConvId, 'messages'),
      where('conversationId', '==', activeConvId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const msgs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessageItem, 'id'>) }))
          .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
        setMessages(msgs);
        msgs.forEach((m) => {
          if (m.senderId !== firebaseUser.uid && !m.readBy.includes(firebaseUser.uid)) {
            void markMessageRead(activeConvId, m.id, firebaseUser.uid);
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `conversations/${activeConvId}/messages`);
      }
    );
    return () => unsub();
  }, [activeConvId, firebaseUser]);

  // Poll presence + typing indicators from server API
  useEffect(() => {
    if (!firebaseUser || conversations.length === 0) return;
    const allPeerIds = Array.from(
      new Set(conversations.flatMap((c) => c.memberIds).filter((id) => id !== firebaseUser.uid))
    );
    const fetchStatus = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        if (allPeerIds.length > 0) {
          const pRes = await fetch(apiUrl(`/api/presence?uids=${encodeURIComponent(allPeerIds.join(','))}`), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pRes.ok) {
            setPresenceMap(await pRes.json());
          }
        }
        if (activeConvId) {
          const tRes = await fetch(apiUrl(`/api/typing/${encodeURIComponent(activeConvId)}`), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (tRes.ok) {
            const data = (await tRes.json()) as { typing: Array<{ uid: string; name: string }> };
            setTypingUsers(data.typing || []);
          }
        }
      } catch {
        // Ignore transient network drops
      }
    };
    void fetchStatus();
    const id = window.setInterval(fetchStatus, 3000);
    return () => window.clearInterval(id);
  }, [firebaseUser, conversations, activeConvId, getIdToken]);

  const notifyTyping = async (isTyping: boolean) => {
    if (!activeConvId || !profile) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      await fetch(apiUrl('/api/typing'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: activeConvId,
          name: profile.fullName,
          isTyping,
        }),
      });
    } catch {
      // Non-fatal
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  const getConvDisplay = (conv: ConversationItem) => {
    if (conv.isGroup) {
      return {
        title: conv.title || 'Group Chat',
        avatar: '',
        online: false,
      };
    }
    const peerId = conv.memberIds.find((id) => id !== firebaseUser?.uid) || '';
    const peer = usersMap[peerId];
    return {
      title: peer?.fullName || 'SK World User',
      avatar: peer?.avatarUrl || '',
      online: presenceMap[peerId]?.online || false,
    };
  };

  const filteredConversations = useMemo(() => {
    if (!convSearch.trim()) return conversations;
    const q = convSearch.toLowerCase();
    return conversations.filter((c) => getConvDisplay(c).title.toLowerCase().includes(q));
  }, [conversations, convSearch, usersMap]);

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const res = await uploadMediaFile(file, 'chat');
      setAttachmentUrl(res.url);
      setAttachmentType(res.kind);
      showToast('Attachment ready', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !profile) return;
    if (!text.trim() && !attachmentUrl) return;

    if (editingMsg) {
      await updateDoc(doc(db, 'conversations', activeConv.id, 'messages', editingMsg.id), {
        text: text.trim().slice(0, 2000),
        edited: true,
        updatedAt: serverTimestamp(),
      });
      setEditingMsg(null);
      setText('');
      return;
    }

    const msgText = text.trim();
    const attUrl = attachmentUrl;
    const attType = attachmentType;
    setText('');
    setAttachmentUrl('');
    setAttachmentType('none');
    setReplyTo(null);
    void notifyTyping(false);

    try {
      await sendChatMessage({
        conversationId: activeConv.id,
        sender: profile,
        text: msgText,
        attachmentUrl: attUrl,
        attachmentType: attType,
        replyToId: replyTo?.id,
        replyToText: replyTo?.text,
        recipientIds: activeConv.memberIds,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Message failed', 'error');
    }
  };

  const handleReaction = async (msg: ChatMessageItem, emoji: string) => {
    if (!activeConv || !firebaseUser) return;
    const current = { ...(msg.reactions || {}) };
    const list = new Set(current[emoji] || []);
    if (list.has(firebaseUser.uid)) list.delete(firebaseUser.uid);
    else list.add(firebaseUser.uid);
    current[emoji] = Array.from(list);
    await updateDoc(doc(db, 'conversations', activeConv.id, 'messages', msg.id), {
      reactions: current,
      updatedAt: serverTimestamp(),
    });
  };

  const handleSoftDelete = async (msg: ChatMessageItem) => {
    if (!activeConv || msg.senderId !== firebaseUser?.uid) return;
    await updateDoc(doc(db, 'conversations', activeConv.id, 'messages', msg.id), {
      text: 'This message was deleted',
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  };

  const handleStartConversation = async () => {
    if (!profile || selectedPeers.length === 0) return;
    try {
      let id: string;
      if (groupMode || selectedPeers.length > 1) {
        id = await createGroupConversation(
          profile,
          groupTitle.trim() || 'Group Conversation',
          selectedPeers
        );
      } else {
        const peer = usersMap[selectedPeers[0]];
        if (!peer) return;
        id = await getOrCreateDirectConversation(profile, peer);
      }
      setActiveConvId(id);
      setSearchParams({ c: id });
      setNewChatOpen(false);
      setSelectedPeers([]);
      setGroupTitle('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start chat', 'error');
    }
  };

  const otherUsers = Object.values(usersMap).filter((u) => u.uid !== firebaseUser?.uid);

  return (
    <div className="h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-6rem)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden grid grid-cols-1 md:grid-cols-12">
      {/* Conversations List */}
      <div
        className={`md:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col ${
          activeConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">Messenger</h1>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold"
            >
              <MessageSquarePlus className="w-4 h-4" /> New
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No conversations yet. Click <strong>New</strong> to message someone on SK World.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const info = getConvDisplay(conv);
              const active = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setSearchParams({ c: conv.id });
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                    active
                      ? 'bg-blue-50/80 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {conv.isGroup ? (
                    <div className="w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-600 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <Avatar src={info.avatar} name={info.title} size="md" online={info.online} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {info.title}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatRelativeTime(conv.lastMessageAt, language)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.lastMessageText || 'Start chatting...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Active Chat Thread */}
      <div className={`md:col-span-8 flex flex-col ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-slate-500">
            Select a conversation or start a new chat to begin real-time messaging.
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden text-xs font-semibold text-blue-600"
                >
                  ← Back
                </button>
                <Avatar
                  src={getConvDisplay(activeConv).avatar}
                  name={getConvDisplay(activeConv).title}
                  size="sm"
                  online={getConvDisplay(activeConv).online}
                />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {getConvDisplay(activeConv).title}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {typingUsers.length > 0
                      ? `${typingUsers[0].name} is typing...`
                      : getConvDisplay(activeConv).online
                        ? 'Active now'
                        : `${activeConv.memberIds.length} participants`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600"
                aria-label="Report conversation"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
              {messages.map((m) => {
                const mine = m.senderId === firebaseUser?.uid;
                const seenByOthers = m.readBy.some((id) => id !== m.senderId);
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] group relative rounded-2xl px-3.5 py-2.5 text-sm ${
                      mine
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {!m.deleted && m.replyToText && (
                        <div className="mb-1.5 rounded-lg bg-black/10 px-2.5 py-1 text-xs opacity-85 border-l-2 border-white/50">
                          {m.replyToText}
                        </div>
                      )}
                      {!m.deleted && m.attachmentUrl && m.attachmentType === 'image' && (
                        <img src={m.attachmentUrl} alt="Chat attachment" className="rounded-xl max-h-56 mb-2" />
                      )}
                      {!m.deleted && m.attachmentUrl && m.attachmentType === 'video' && (
                        <video src={m.attachmentUrl} controls className="rounded-xl max-h-56 mb-2" />
                      )}
                      {!m.deleted && m.attachmentUrl && m.attachmentType === 'file' && (
                        <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="underline text-xs block mb-1">
                          Download attached file
                        </a>
                      )}
                      {m.text && <p className={m.deleted ? 'italic opacity-70' : ''}>{m.text}</p>}

                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-75">
                        {m.edited && <span>edited</span>}
                        <span>{formatRelativeTime(m.createdAt, language)}</span>
                        {mine && (seenByOthers ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
                      </div>

                      {!m.deleted && (
                        <div className="hidden group-hover:flex items-center gap-1 mt-1.5 pt-1 border-t border-white/15">
                          {QUICK_EMOJIS.slice(0, 4).map((em) => (
                            <button key={em} type="button" onClick={() => void handleReaction(m, em)} className="text-xs hover:scale-125">
                              {em}
                            </button>
                          ))}
                          <button type="button" onClick={() => setReplyTo(m)} className="p-0.5 ml-1" title="Reply">
                            <Reply className="w-3 h-3" />
                          </button>
                          {mine && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsg(m);
                                  setText(m.text);
                                }}
                                className="p-0.5"
                                title="Edit"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button type="button" onClick={() => void handleSoftDelete(m)} className="p-0.5" title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1 text-xs">
                        {Object.entries(m.reactions).map(
                          ([emoji, uids]) =>
                            uids.length > 0 && (
                              <span key={emoji} className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px]">
                                {emoji} {uids.length}
                              </span>
                            )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {(replyTo || editingMsg) && (
                <div className="flex items-center justify-between text-xs text-blue-600 px-2">
                  <span>{editingMsg ? 'Editing message' : `Replying to: ${replyTo?.text.slice(0, 50)}`}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setEditingMsg(null);
                      setText('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {showEmojis && (
                <div className="flex gap-2 px-2 py-1">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setText((prev) => prev + em);
                        setShowEmojis(false);
                      }}
                      className="text-lg hover:scale-125 transition-transform"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {(uploadingAttachment || attachmentUrl) && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  {uploadingAttachment ? (
                    <span className="text-xs text-slate-500">Uploading attachment...</span>
                  ) : (
                    <div className="flex items-center gap-2.5 min-w-0">
                      {attachmentType === 'image' && (
                        <img src={attachmentUrl} alt="Pending attachment" className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        Attached {attachmentType}
                      </span>
                    </div>
                  )}
                  {!uploadingAttachment && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentUrl('');
                        setAttachmentType('none');
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                      aria-label="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="cursor-pointer p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Paperclip className="w-5 h-5" />
                  <input type="file" accept="image/*,video/mp4,video/webm,application/pdf" onChange={(e) => void handleAttachment(e)} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowEmojis((v) => !v)}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    void notifyTyping(e.target.value.trim().length > 0);
                  }}
                  placeholder="Write a message..."
                  maxLength={2000}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={uploadingAttachment || (!text.trim() && !attachmentUrl)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* New Chat / Group Modal */}
      {newChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Start Conversation</h2>
              <button type="button" onClick={() => setNewChatOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={groupMode}
                onChange={(e) => setGroupMode(e.target.checked)}
                className="accent-blue-600"
              />
              <span>Create a Group Conversation</span>
            </label>

            {groupMode && (
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Group chat name"
                maxLength={100}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm"
              />
            )}

            <div className="max-h-60 overflow-y-auto space-y-2">
              {otherUsers.map((u) => {
                const selected = selectedPeers.includes(u.uid);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() =>
                      setSelectedPeers((prev) =>
                        groupMode
                          ? selected
                            ? prev.filter((id) => id !== u.uid)
                            : [...prev, u.uid]
                          : [u.uid]
                      )
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left ${
                      selected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatarUrl} name={u.fullName} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{u.fullName}</p>
                        <p className="text-xs text-slate-500">@{u.username}</p>
                      </div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={selectedPeers.length === 0}
              onClick={() => void handleStartConversation()}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold"
            >
              Start Chat
            </button>
          </div>
        </div>
      )}

      {activeConv && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="message"
          targetId={activeConv.id}
        />
      )}
    </div>
  );
};
