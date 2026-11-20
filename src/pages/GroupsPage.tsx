import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flag, Globe, Lock, Plus, Trash2, UsersRound, X } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { createGroup, createPost, toggleGroupMembership } from '../services/skworldService';
import type { GroupItem, PostItem } from '../types/skworld';
import { PostCard } from '../components/PostCard';
import { ReportModal } from '../components/ReportModal';

export const GroupsPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetGroupId = searchParams.get('id');

  const [publicGroups, setPublicGroups] = useState<GroupItem[]>([]);
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, boolean>>({});
  const [groupPosts, setGroupPosts] = useState<PostItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportGroupId, setReportGroupId] = useState<string | null>(null);

  // Create Group Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technology');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [postText, setPostText] = useState('');

  const groups = useMemo(() => {
    const map = new Map<string, GroupItem>();
    [...publicGroups, ...myGroups].forEach((g) => map.set(g.id, g));
    return Array.from(map.values());
  }, [publicGroups, myGroups]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubPublic = onSnapshot(
      query(collection(db, 'groups'), where('privacy', '==', 'public')),
      (snap) => {
        setPublicGroups(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupItem, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    );
    const unsubMine = onSnapshot(
      query(collection(db, 'groups'), where('creatorId', '==', firebaseUser.uid)),
      (snap) => {
        setMyGroups(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupItem, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    );
    return () => {
      unsubPublic();
      unsubMine();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || groups.length === 0) return;
    let cancelled = false;
    Promise.all(
      groups.map(async (g) => {
        const m = await getDoc(doc(db, 'groups', g.id, 'members', firebaseUser.uid));
        return [g.id, m.exists()] as const;
      })
    )
      .then((entries) => {
        if (!cancelled) {
          setMemberMap(Object.fromEntries(entries));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, groups]);

  useEffect(() => {
    if (!targetGroupId || groups.length === 0) return;
    const found = groups.find((g) => g.id === targetGroupId);
    if (found) setSelectedGroup(found);
  }, [targetGroupId, groups]);

  useEffect(() => {
    if (!selectedGroup) {
      setGroupPosts([]);
      return;
    }
    const q = query(
      collection(db, 'posts'),
      where('groupId', '==', selectedGroup.id),
      where('visibility', '==', 'public')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setGroupPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
    );
    return () => unsub();
  }, [selectedGroup]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    try {
      await createGroup({
        creator: profile,
        name,
        description,
        category,
        privacy,
        coverUrl,
      });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setCoverUrl('');
      showToast('Community group created!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create group', 'error');
    }
  };

  const handleGroupPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedGroup || !postText.trim()) return;
    try {
      await createPost({
        author: profile,
        content: postText,
        mediaUrls: [],
        mediaType: 'text',
        visibility: 'public',
        groupId: selectedGroup.id,
      });
      setPostText('');
      showToast('Posted to group', 'success');
    } catch {
      showToast('Failed to publish group post', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-blue-600" />
            Groups & Communities
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Join interest communities or build your own public or private group.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </div>

      {selectedGroup ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setSelectedGroup(null);
              if (targetGroupId) setSearchParams({});
            }}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to all groups
          </button>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <img
              src={selectedGroup.coverUrl || '/src/assets/images/community_cover_tech_1795185891829.jpg'}
              alt={selectedGroup.name}
              className="w-full h-44 object-cover"
            />
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedGroup.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedGroup.category} · {selectedGroup.privacy === 'public' ? 'Public Group' : 'Private Group'} ·{' '}
                  <span className="font-mono-tabular">{selectedGroup.membersCount}</span> members
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{selectedGroup.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleGroupMembership(
                        selectedGroup.id,
                        firebaseUser.uid,
                        Boolean(memberMap[selectedGroup.id])
                      ).then(() =>
                        setMemberMap((prev) => ({
                          ...prev,
                          [selectedGroup.id]: !prev[selectedGroup.id],
                        }))
                      )
                    }
                    className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                      memberMap[selectedGroup.id]
                        ? 'border border-slate-200 dark:border-slate-700'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {memberMap[selectedGroup.id] ? 'Leave Group' : 'Join Group'}
                  </button>
                )}
                {firebaseUser?.uid === selectedGroup.creatorId && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'groups', selectedGroup.id));
                        setSelectedGroup(null);
                        if (targetGroupId) setSearchParams({});
                        showToast('Group deleted', 'info');
                      } catch {
                        showToast('Could not delete group', 'error');
                      }
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-600"
                    aria-label="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReportGroupId(selectedGroup.id)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500"
                  aria-label="Report group"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {memberMap[selectedGroup.id] && (
            <form
              onSubmit={handleGroupPost}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3"
            >
              <input
                type="text"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder={`Share a discussion in ${selectedGroup.name}...`}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={!postText.trim()}
                className="rounded-xl bg-blue-600 text-white px-4 py-2.5 text-xs font-semibold"
              >
                Post
              </button>
            </form>
          )}

          <div className="space-y-4">
            {groupPosts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No posts in this group yet.</p>
            ) : (
              groupPosts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <img
            src="/src/assets/images/community_cover_tech_1795185891829.jpg"
            alt="Communities"
            className="w-full max-w-md h-40 object-cover rounded-2xl mx-auto mb-4"
          />
          <h2 className="text-base font-bold">Launch the first SK World community</h2>
          <p className="text-xs text-slate-500 mt-1">Create a group for creators, tech builders, photographers, or local friends.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
            >
              <div>
                <img
                  src={g.coverUrl || '/src/assets/images/community_cover_tech_1795185891829.jpg'}
                  alt={g.name}
                  className="w-full h-32 object-cover"
                />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-base truncate">{g.name}</h2>
                    {g.privacy === 'public' ? (
                      <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>
                  <p className="text-xs text-slate-400 mt-2 font-mono-tabular">
                    {g.membersCount} members · {g.postsCount} posts
                  </p>
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Open Group
                </button>
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleGroupMembership(g.id, firebaseUser.uid, Boolean(memberMap[g.id])).then(
                        () => setMemberMap((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                      )
                    }
                    className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                      memberMap[g.id]
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {memberMap[g.id] ? 'Joined' : 'Join'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Create Community Group</h2>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
              <textarea
                rows={3}
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this community about?"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  maxLength={40}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-center text-xs">
                {uploadingCover ? 'Uploading cover...' : coverUrl ? 'Cover image uploaded' : 'Upload group cover image (optional)'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadingCover(true);
                      try {
                        const res = await uploadMediaFile(f, 'groups');
                        setCoverUrl(res.url);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Cover upload failed', 'error');
                      } finally {
                        setUploadingCover(false);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                disabled={uploadingCover}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {reportGroupId && (
        <ReportModal
          open={Boolean(reportGroupId)}
          onClose={() => setReportGroupId(null)}
          targetType="group"
          targetId={reportGroupId}
        />
      )}
    </div>
  );
};
