import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Check, MessageSquare, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  cancelFriendRequest,
  fetchAllActiveUsers,
  getOrCreateDirectConversation,
  removeFriendship,
  respondFriendRequest,
  sendFriendRequest,
  toggleBlockUser,
  toggleFollow,
} from '../services/skworldService';
import type { FriendRequestItem, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';

export const FriendsPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab');
  const validTabs = new Set(['discover', 'requests', 'friends', 'following', 'blocked']);
  const [tab, setTab] = useState<'discover' | 'requests' | 'friends' | 'following' | 'blocked'>(
    initialTab && validTabs.has(initialTab) ? (initialTab as 'discover' | 'requests' | 'friends' | 'following' | 'blocked') : 'discover'
  );
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [incomingReqs, setIncomingReqs] = useState<FriendRequestItem[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [friendsA, setFriendsA] = useState<Set<string>>(new Set());
  const [friendsB, setFriendsB] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const friendIds = useMemo(() => new Set([...friendsA, ...friendsB]), [friendsA, friendsB]);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab && validTabs.has(paramTab)) {
      setTab(paramTab as typeof tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    fetchAllActiveUsers(50)
      .then((list) => setAllUsers(list.filter((u) => u.uid !== uid)))
      .catch(() => {});

    const unsubIn = onSnapshot(
      query(collection(db, 'friend_requests'), where('toId', '==', uid), where('status', '==', 'pending')),
      (snap) => setIncomingReqs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequestItem, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'friend_requests')
    );
    const unsubOut = onSnapshot(
      query(collection(db, 'friend_requests'), where('fromId', '==', uid), where('status', '==', 'pending')),
      (snap) => setOutgoingIds(new Set(snap.docs.map((d) => (d.data() as FriendRequestItem).toId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'friend_requests')
    );
    const unsubFA = onSnapshot(
      query(collection(db, 'friendships'), where('userA', '==', uid)),
      (snap) => setFriendsA(new Set(snap.docs.map((d) => (d.data() as { userB: string }).userB))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );
    const unsubFB = onSnapshot(
      query(collection(db, 'friendships'), where('userB', '==', uid)),
      (snap) => setFriendsB(new Set(snap.docs.map((d) => (d.data() as { userA: string }).userA))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );
    const unsubFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', uid)),
      (snap) => setFollowingIds(new Set(snap.docs.map((d) => (d.data() as { followingId: string }).followingId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );
    const unsubFollowers = onSnapshot(
      query(collection(db, 'follows'), where('followingId', '==', uid)),
      (snap) => setFollowerIds(new Set(snap.docs.map((d) => (d.data() as { followerId: string }).followerId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );
    const unsubBlocks = onSnapshot(
      query(collection(db, 'blocks'), where('blockerId', '==', uid)),
      (snap) => setBlockedIds(new Set(snap.docs.map((d) => (d.data() as { blockedId: string }).blockedId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'blocks')
    );

    return () => {
      unsubIn();
      unsubOut();
      unsubFA();
      unsubFB();
      unsubFollowing();
      unsubFollowers();
      unsubBlocks();
    };
  }, [firebaseUser]);

  const handleMessage = async (peer: UserProfile) => {
    if (!profile) return;
    try {
      const convId = await getOrCreateDirectConversation(profile, peer);
      navigate(`/messages?c=${convId}`);
    } catch {
      showToast('Could not open conversation', 'error');
    }
  };

  const friendsList = allUsers.filter((u) => friendIds.has(u.uid));
  const followingList = allUsers.filter((u) => followingIds.has(u.uid) || followerIds.has(u.uid));
  const blockedList = allUsers.filter((u) => blockedIds.has(u.uid));
  const discoverList = allUsers.filter((u) => !blockedIds.has(u.uid));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Friends & Network
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage friend requests, followers, connections, and blocked accounts.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        {[
          { id: 'discover', label: `Discover (${discoverList.length})` },
          { id: 'requests', label: `Requests (${incomingReqs.length})` },
          { id: 'friends', label: `Friends (${friendsList.length})` },
          { id: 'following', label: `Followers & Following` },
          { id: 'blocked', label: `Blocked (${blockedList.length})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id as typeof tab);
              setSearchParams({ tab: item.id });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === item.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="space-y-3">
          {incomingReqs.length === 0 ? (
            <p className="text-sm text-slate-500 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              No pending friend requests.
            </p>
          ) : (
            incomingReqs.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={req.fromAvatar} name={req.fromName || 'User'} size="md" />
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{req.fromName}</p>
                    <p className="text-xs text-slate-500">@{req.fromUsername}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => profile && void respondFriendRequest(req.id, req.fromId, profile, true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 text-white px-3.5 py-2 text-xs font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => profile && void respondFriendRequest(req.id, req.fromId, profile, false)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
                  >
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'discover' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {discoverList.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-2">No other users found yet.</p>
          ) : (
            discoverList.map((u) => {
              const isFriend = friendIds.has(u.uid);
              const isPendingOut = outgoingIds.has(u.uid);
              const isFollowing = followingIds.has(u.uid);
              return (
                <div
                  key={u.uid}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
                >
                  <Link to={`/profile/${u.username}`} className="flex items-center gap-3 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.fullName} size="md" verified={u.isVerified} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{u.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {profile && (
                      <button
                        type="button"
                        onClick={() => void toggleFollow(profile, u.uid, isFollowing)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                          isFollowing
                            ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-slate-900 dark:bg-slate-800 text-white'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                    {profile && !isFriend && (
                      isPendingOut ? (
                        <button
                          type="button"
                          onClick={() => void cancelFriendRequest(profile.uid, u.uid)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void sendFriendRequest(profile, u.uid).then(() => showToast('Friend request sent', 'success'))}
                          className="rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Add
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {friendsList.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-2">No friends added yet.</p>
          ) : (
            friendsList.map((u) => (
              <div
                key={u.uid}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
              >
                <Link to={`/profile/${u.username}`} className="flex items-center gap-3 min-w-0">
                  <Avatar src={u.avatarUrl} name={u.fullName} size="md" verified={u.isVerified} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{u.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleMessage(u)}
                    className="p-2 rounded-xl bg-blue-600 text-white"
                    aria-label="Message friend"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => firebaseUser && void removeFriendship(firebaseUser.uid, u.uid)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-600"
                    aria-label="Remove friend"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'following' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {followingList.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-2">No followers or following connections yet.</p>
          ) : (
            followingList.map((u) => (
              <div
                key={u.uid}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between"
              >
                <Link to={`/profile/${u.username}`} className="flex items-center gap-3">
                  <Avatar src={u.avatarUrl} name={u.fullName} size="md" />
                  <div>
                    <p className="font-semibold text-sm">{u.fullName}</p>
                    <p className="text-xs text-slate-500">
                      @{u.username} · {followerIds.has(u.uid) ? 'Follows you' : 'Following'}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleMessage(u)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold"
                >
                  Message
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-3">
          {blockedList.length === 0 ? (
            <p className="text-sm text-slate-500">You have not blocked any users.</p>
          ) : (
            blockedList.map((u) => (
              <div
                key={u.uid}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={u.avatarUrl} name={u.fullName} size="sm" />
                  <div>
                    <p className="font-semibold text-sm">{u.fullName}</p>
                    <p className="text-xs text-slate-500">@{u.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => firebaseUser && void toggleBlockUser(firebaseUser.uid, u.uid, true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold"
                >
                  <Ban className="w-3.5 h-3.5" /> Unblock
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
