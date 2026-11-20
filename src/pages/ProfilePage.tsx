import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  Calendar,
  Flag,
  Globe as GlobeIcon,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  cancelFriendRequest,
  getOrCreateDirectConversation,
  removeFriendship,
  sendFriendRequest,
  toggleBlockUser,
  toggleFollow,
} from '../services/skworldService';
import type { PostItem, StoryItem, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { ReportModal } from '../components/ReportModal';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username?: string }>();
  const { profile: myProfile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [tab, setTab] = useState<'posts' | 'photos' | 'videos' | 'stories'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [reqPending, setReqPending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        if (!username || username === myProfile?.username) {
          setUserProfile(myProfile);
          setLoading(false);
          return;
        }
        const unameSnap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
        let uid = unameSnap.exists() ? (unameSnap.data() as { uid: string }).uid : '';
        if (!uid) {
          // Support direct UID profile links (e.g. from notifications)
          const directSnap = await getDoc(doc(db, 'users', username));
          if (directSnap.exists()) {
            setUserProfile(directSnap.data() as UserProfile);
            setLoading(false);
            return;
          }
          setUserProfile(null);
          setLoading(false);
          return;
        }
        const userSnap = await getDoc(doc(db, 'users', uid));
        setUserProfile(userSnap.exists() ? (userSnap.data() as UserProfile) : null);
      } catch {
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [username, myProfile]);

  useEffect(() => {
    if (!userProfile || !firebaseUser) return;
    const isMe = userProfile.uid === firebaseUser.uid;
    const qPosts = isMe
      ? query(collection(db, 'posts'), where('authorId', '==', userProfile.uid))
      : query(
          collection(db, 'posts'),
          where('authorId', '==', userProfile.uid),
          where('visibility', '==', 'public')
        );
    const unsubPosts = onSnapshot(
      qPosts,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
          const tb = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
          return tb - ta;
        });
        setPosts(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );

    const qStories = isMe
      ? query(collection(db, 'stories'), where('authorId', '==', userProfile.uid))
      : query(
          collection(db, 'stories'),
          where('authorId', '==', userProfile.uid),
          where('visibility', '==', 'public')
        );
    getDocs(qStories)
      .then((snap) => {
        const now = Date.now();
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }))
          .filter((s) => {
            if (isMe) return true;
            const exp = (s.expiresAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
            return exp > now;
          });
        setStories(list);
      })
      .catch(() => {});

    if (!isMe) {
      getDoc(doc(db, 'follows', `${firebaseUser.uid}_${userProfile.uid}`))
        .then((s) => setIsFollowing(s.exists()))
        .catch(() => {});
      const sorted = [firebaseUser.uid, userProfile.uid].sort();
      getDoc(doc(db, 'friendships', `${sorted[0]}_${sorted[1]}`))
        .then((s) => setIsFriend(s.exists()))
        .catch(() => {});
      getDoc(doc(db, 'friend_requests', `${firebaseUser.uid}_${userProfile.uid}`))
        .then((s) => setReqPending(s.exists() && (s.data() as { status: string }).status === 'pending'))
        .catch(() => {});
      getDoc(doc(db, 'blocks', `${firebaseUser.uid}_${userProfile.uid}`))
        .then((s) => setIsBlocked(s.exists()))
        .catch(() => {});
    }

    return () => unsubPosts();
  }, [userProfile, firebaseUser]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 animate-pulse space-y-4">
        <div className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <h1 className="text-lg font-bold">Profile not found</h1>
        <p className="text-sm text-slate-500 mt-1">This SK World account may have changed username or been removed.</p>
      </div>
    );
  }

  const isMe = firebaseUser?.uid === userProfile.uid;
  const joinedDate =
    userProfile.createdAt &&
    typeof userProfile.createdAt === 'object' &&
    'toDate' in userProfile.createdAt
      ? (userProfile.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : 'Recently';

  const photoItems = posts.filter((p) => p.mediaType === 'image' && p.mediaUrls.length > 0);
  const videoItems = posts.filter((p) => p.mediaType === 'video' && p.mediaUrls.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Cover */}
        <div className="h-44 sm:h-56 bg-gradient-to-r from-slate-900 via-blue-900 to-violet-900 relative">
          <img
            src={userProfile.coverUrl || '/src/assets/images/community_cover_photo_1795185891821.jpg'}
            alt="Profile cover"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-90"
          />
        </div>

        <div className="px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative z-10">
            <div className="ring-4 ring-white dark:ring-slate-900 rounded-full w-fit">
              <Avatar src={userProfile.avatarUrl} name={userProfile.fullName} size="xl" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isMe ? (
                <Link
                  to="/settings/profile"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Profile
                </Link>
              ) : (
                myProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFollow(myProfile, userProfile.uid, isFollowing).then(() =>
                          setIsFollowing((v) => !v)
                        )
                      }
                      className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                        isFollowing
                          ? 'border border-slate-200 dark:border-slate-700'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>

                    {isFriend ? (
                      <button
                        type="button"
                        onClick={() =>
                          void removeFriendship(myProfile.uid, userProfile.uid).then(() => setIsFriend(false))
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Friends
                      </button>
                    ) : reqPending ? (
                      <button
                        type="button"
                        onClick={() =>
                          void cancelFriendRequest(myProfile.uid, userProfile.uid).then(() =>
                            setReqPending(false)
                          )
                        }
                        className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold"
                      >
                        Request Sent
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void sendFriendRequest(myProfile, userProfile.uid).then(() => {
                            setReqPending(true);
                            showToast('Friend request sent', 'success');
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Add Friend
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const cid = await getOrCreateDirectConversation(myProfile, userProfile);
                          navigate(`/messages?c=${cid}`);
                        } catch {
                          showToast('Could not start conversation', 'error');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void toggleBlockUser(myProfile.uid, userProfile.uid, isBlocked).then(() => {
                          setIsBlocked((v) => !v);
                          showToast(!isBlocked ? 'User blocked' : 'User unblocked', 'info');
                        })
                      }
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600"
                      title={isBlocked ? 'Unblock user' : 'Block user'}
                    >
                      <Ban className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600"
                      title="Report user"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </>
                )
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {userProfile.fullName}
              </h1>
              {userProfile.isVerified && <BadgeCheck className="w-5 h-5 text-blue-600" />}
              {userProfile.isPrivate && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Lock className="w-3.5 h-3.5" /> Private Profile
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              @{userProfile.username}
              {userProfile.membershipTier !== 'free' && (
                <>
                  {' '}
                  · <span className="text-violet-600 font-medium capitalize">{userProfile.membershipTier.replace('_', ' ')}</span>
                </>
              )}
            </p>
            {userProfile.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-300 max-w-2xl leading-relaxed">
                {userProfile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              {userProfile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {userProfile.location}
                </span>
              )}
              {userProfile.website && (
                <a
                  href={userProfile.website.startsWith('http') ? userProfile.website : `https://${userProfile.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <GlobeIcon className="w-3.5 h-3.5" /> {userProfile.website}
                </a>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Joined {joinedDate}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-3 text-sm">
              <span>
                <strong className="font-mono-tabular text-slate-900 dark:text-white">{userProfile.postsCount}</strong>{' '}
                <span className="text-slate-500">Posts</span>
              </span>
              <span>
                <strong className="font-mono-tabular text-slate-900 dark:text-white">{userProfile.followersCount}</strong>{' '}
                <span className="text-slate-500">Followers</span>
              </span>
              <span>
                <strong className="font-mono-tabular text-slate-900 dark:text-white">{userProfile.followingCount}</strong>{' '}
                <span className="text-slate-500">Following</span>
              </span>
              <span>
                <strong className="font-mono-tabular text-slate-900 dark:text-white">{userProfile.friendsCount}</strong>{' '}
                <span className="text-slate-500">Friends</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        {(['posts', 'photos', 'videos', 'stories'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize ${
              tab === item
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {userProfile.isPrivate && !isMe && !isFollowing && !isFriend ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h2 className="text-base font-semibold">This profile is private</h2>
          <p className="text-xs text-slate-500 mt-1">Follow or connect as friends to view private updates.</p>
        </div>
      ) : (
        <>
          {tab === 'posts' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No posts published yet.</p>
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} />)
              )}
            </div>
          )}

          {tab === 'photos' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoItems.length === 0 ? (
                <p className="text-sm text-slate-500 col-span-full text-center py-8">No photos uploaded yet.</p>
              ) : (
                photoItems.flatMap((p) =>
                  p.mediaUrls.map((url, i) => (
                    <Link key={`${p.id}_${i}`} to={`/post/${p.id}`} className="block group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                      <img
                        src={url}
                        alt="User photo"
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
                      />
                    </Link>
                  ))
                )
              )}
            </div>
          )}

          {tab === 'videos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videoItems.map((p) => (
                <video
                  key={p.id}
                  src={p.mediaUrls[0]}
                  controls
                  className="w-full rounded-2xl bg-black max-h-80"
                />
              ))}
            </div>
          )}

          {tab === 'stories' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stories.map((s) => (
                <div key={s.id} className="aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900">
                  {s.mediaType === 'video' ? (
                    <video src={s.mediaUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={s.mediaUrl} alt={s.caption || 'Story'} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="profile"
        targetId={userProfile.uid}
      />
    </div>
  );
};
