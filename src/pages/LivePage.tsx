import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  Flag,
  Radio,
  Send,
  StopCircle,
  Video,
  VideoOff,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { apiUrl } from '../lib/apiBase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { formatRelativeTime } from '../lib/i18n';
import type { CommentItem, LiveStreamItem } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { ReportModal } from '../components/ReportModal';

interface ConfigStatus {
  liveStreamingConfigured: boolean;
  liveStreamingRequiredEnv: string[];
}

export const LivePage: React.FC = () => {
  const { profile, firebaseUser, getIdToken } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [streams, setStreams] = useState<LiveStreamItem[]>([]);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<CommentItem[]>([]);
  const [chatText, setChatText] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [liveKitTokenInfo, setLiveKitTokenInfo] = useState<{ url: string; token: string } | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/config-status'))
      .then((r) => r.json())
      .then((data: ConfigStatus) => setConfig(data))
      .catch(() => {
        setConfig({
          liveStreamingConfigured: false,
          liveStreamingRequiredEnv: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
        });
      });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'live_streams'), where('status', 'in', ['live', 'ended']), limit(25));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveStreamItem, 'id'>) }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setStreams(list);
        if (!activeStreamId && list.length > 0) {
          const firstLive = list.find((s) => s.status === 'live') || list[0];
          setActiveStreamId(firstLive.id);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'live_streams')
    );
    return () => unsub();
  }, [firebaseUser, activeStreamId]);

  const activeStream = streams.find((s) => s.id === activeStreamId) || null;

  useEffect(() => {
    if (!activeStreamId || !firebaseUser) {
      setChatMessages([]);
      return;
    }
    const q = query(
      collection(db, 'live_streams', activeStreamId, 'chat'),
      where('targetId', '==', activeStreamId),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CommentItem, 'id'>) }))
          .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
        setChatMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `live_streams/${activeStreamId}/chat`)
    );
    return () => unsub();
  }, [activeStreamId, firebaseUser]);

  // Fetch LiveKit room token only when real credentials are configured on the server
  useEffect(() => {
    if (!activeStream || activeStream.status !== 'live' || !config?.liveStreamingConfigured) {
      setLiveKitTokenInfo(null);
      return;
    }
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(apiUrl('/api/livekit/token'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: activeStream.id,
            participantName: profile?.fullName || 'SK World Member',
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { configured?: boolean; url?: string; token?: string };
        if (!cancelled && data.configured && data.url && data.token) {
          setLiveKitTokenInfo({ url: data.url, token: data.token });
        }
      } catch {
        // Ignore transient network errors
      }
    };
    void fetchToken();
    return () => {
      cancelled = true;
    };
  }, [activeStream, config?.liveStreamingConfigured, getIdToken, profile?.fullName]);

  const handleStartStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (streamTitle.trim().length < 2) {
      showToast('Enter a stream title (at least 2 characters).', 'error');
      return;
    }
    setStarting(true);
    try {
      const ref = await addDoc(collection(db, 'live_streams'), {
        hostId: profile.uid,
        hostName: profile.fullName,
        hostAvatar: profile.avatarUrl || '',
        title: streamTitle.trim().slice(0, 120),
        thumbnailUrl: '/src/assets/images/community_cover_tech_1795185891829.jpg',
        status: 'live',
        viewerCount: 1,
        createdAt: serverTimestamp(),
      });
      setStreamTitle('');
      setActiveStreamId(ref.id);
      showToast('Live stream room created.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'live_streams');
    } finally {
      setStarting(false);
    }
  };

  const handleEndStream = async (stream: LiveStreamItem) => {
    if (!profile || stream.hostId !== profile.uid) return;
    try {
      await updateDoc(doc(db, 'live_streams', stream.id), {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
      showToast('Stream ended.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `live_streams/${stream.id}`);
    }
  };

  const handleJoinViewer = async (stream: LiveStreamItem) => {
    setActiveStreamId(stream.id);
    if (stream.status === 'live' && stream.hostId !== profile?.uid) {
      try {
        await updateDoc(doc(db, 'live_streams', stream.id), {
          viewerCount: increment(1),
        });
      } catch {
        // Ignore if stream just ended
      }
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeStream || !chatText.trim()) return;
    const text = chatText.trim().slice(0, 1000);
    setChatText('');
    try {
      await addDoc(collection(db, 'live_streams', activeStream.id, 'chat'), {
        targetId: activeStream.id,
        authorId: profile.uid,
        authorName: profile.fullName,
        authorUsername: profile.username,
        authorAvatar: profile.avatarUrl || '',
        content: text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      showToast('Could not send chat message.', 'error');
      handleFirestoreError(err, OperationType.CREATE, `live_streams/${activeStream.id}/chat`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('live')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time broadcast rooms and interactive audience chat on SK World.
          </p>
        </div>

        <form onSubmit={handleStartStream} className="flex items-center gap-2">
          <input
            type="text"
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            maxLength={120}
            placeholder="Stream title..."
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold whitespace-nowrap"
          >
            <Radio className="w-4 h-4" />
            <span>{starting ? 'Starting...' : t('goLive')}</span>
          </button>
        </form>
      </div>

      {/* Honest Server Video Transport Status */}
      {config && !config.liveStreamingConfigured && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">
              WebRTC LiveKit media server credentials are not configured yet.
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Live room creation and real-time Firestore audience chat are active now. To enable low-latency WebRTC video broadcasting, set{' '}
              <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                {config.liveStreamingRequiredEnv.join(', ')}
              </code>{' '}
              in your server environment.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Broadcast Stage + Chat */}
        <div className="lg:col-span-8 space-y-4">
          {activeStream ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="relative aspect-video bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                {activeStream.status === 'live' ? (
                  liveKitTokenInfo ? (
                    <div className="space-y-3 max-w-md">
                      <Video className="w-10 h-10 text-emerald-400 mx-auto" />
                      <p className="text-base font-semibold">LiveKit Broadcast Session Ready</p>
                      <p className="text-xs text-slate-300">
                        Connected to {liveKitTokenInfo.url} · Room ID {activeStream.id}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-md">
                      <VideoOff className="w-10 h-10 text-slate-400 mx-auto" />
                      <p className="text-base font-semibold">Live Room Stage ({activeStream.title})</p>
                      <p className="text-xs text-slate-300">
                        {config?.liveStreamingConfigured
                          ? 'Connecting to media relay...'
                          : 'Real-time stream room & chat active. Configure LiveKit environment keys to publish camera/screen video.'}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <Radio className="w-9 h-9 text-slate-500 mx-auto" />
                    <p className="text-base font-semibold">This broadcast has ended</p>
                  </div>
                )}

                <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`px-2.5 py-1 rounded-lg ${
                      activeStream.status === 'live'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {activeStream.status === 'live' ? 'LIVE' : 'ENDED'}
                  </span>
                  <span className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono-tabular">
                    <Eye className="w-3.5 h-3.5" />
                    {activeStream.viewerCount}
                  </span>
                </div>
              </div>

              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={activeStream.hostAvatar} name={activeStream.hostName} size="md" />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                      {activeStream.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Hosted by {activeStream.hostName} · {formatRelativeTime(activeStream.createdAt, language)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {profile?.uid === activeStream.hostId && activeStream.status === 'live' && (
                    <button
                      type="button"
                      onClick={() => void handleEndStream(activeStream)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-xs font-semibold"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>{t('endStream')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReportTargetId(activeStream.id)}
                    aria-label="Report stream"
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Real-Time Stream Chat */}
              <div className="p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Live Stream Chat
                </h3>
                <div className="h-56 overflow-y-auto space-y-2.5 pr-1">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center">
                      No messages in this room yet. Say hello!
                    </p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2.5 text-sm">
                        <Avatar src={msg.authorAvatar} name={msg.authorName} size="xs" />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white mr-2 text-xs">
                            {msg.authorName}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 text-xs break-words">
                            {msg.content}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    maxLength={1000}
                    placeholder="Send a live comment..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!chatText.trim()}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
              <Radio className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                No active streams right now
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Start a live broadcast room above to connect with your followers in real time.
              </p>
            </div>
          )}
        </div>

        {/* Streams Directory */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Recent & Live Rooms
          </h2>
          {streams.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-xs text-slate-500">
              Broadcast history will appear here.
            </div>
          ) : (
            streams.map((stream) => (
              <button
                key={stream.id}
                type="button"
                onClick={() => void handleJoinViewer(stream)}
                className={`w-full text-left rounded-2xl border p-3.5 transition-colors flex items-center gap-3 ${
                  stream.id === activeStreamId
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Avatar src={stream.hostAvatar} name={stream.hostName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {stream.title}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        stream.status === 'live'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {stream.status === 'live' ? 'LIVE' : 'ENDED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {stream.hostName} · <span className="font-mono-tabular">{stream.viewerCount}</span> viewers
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {reportTargetId && (
        <ReportModal
          open={Boolean(reportTargetId)}
          onClose={() => setReportTargetId(null)}
          targetType="stream"
          targetId={reportTargetId}
        />
      )}
    </div>
  );
};
