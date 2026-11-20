import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AdminRoleType,
  PostItem,
  ReportItem,
  UserProfile,
  VisibilityType,
} from '../types/skworld';

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_\u0980-\u09FF]+/g) || [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 10);
}

export async function createNotification(input: {
  recipientId: string;
  actor: UserProfile;
  type:
    | 'follow'
    | 'friend_request'
    | 'friend_accept'
    | 'like'
    | 'comment'
    | 'reply'
    | 'mention'
    | 'story_reply'
    | 'message'
    | 'group_invite'
    | 'announcement';
  targetId?: string;
  message: string;
}) {
  if (!input.recipientId || input.recipientId === input.actor.uid) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId: input.recipientId,
      actorId: input.actor.uid,
      actorName: input.actor.fullName,
      actorAvatar: input.actor.avatarUrl || '',
      type: input.type,
      targetId: input.targetId || '',
      message: input.message.slice(0, 300),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Notification write skipped:', err);
  }
}

export async function createPost(input: {
  author: UserProfile;
  content: string;
  mediaUrls: string[];
  mediaType: 'text' | 'image' | 'video';
  location?: string;
  visibility: VisibilityType;
  groupId?: string;
}) {
  const hashtags = extractHashtags(input.content);
  const now = serverTimestamp();
  try {
    const postRef = await addDoc(collection(db, 'posts'), {
      authorId: input.author.uid,
      authorName: input.author.fullName,
      authorUsername: input.author.username,
      authorAvatar: input.author.avatarUrl || '',
      authorVerified: Boolean(input.author.isVerified),
      content: input.content.trim().slice(0, 5000),
      mediaUrls: input.mediaUrls.slice(0, 6),
      mediaType: input.mediaType,
      hashtags,
      taggedUserIds: [],
      location: (input.location || '').trim().slice(0, 100),
      visibility: input.visibility,
      groupId: input.groupId || '',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await updateDoc(doc(db, 'users', input.author.uid), {
      postsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    if (input.groupId) {
      await updateDoc(doc(db, 'groups', input.groupId), {
        postsCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    return postRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'posts');
  }
}

export async function updatePost(
  postId: string,
  updates: { content: string; location?: string; visibility: VisibilityType }
) {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      content: updates.content.trim().slice(0, 5000),
      hashtags: extractHashtags(updates.content),
      location: (updates.location || '').trim().slice(0, 100),
      visibility: updates.visibility,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function deletePost(postId: string, authorId: string) {
  try {
    await deleteDoc(doc(db, 'posts', postId));
    await updateDoc(doc(db, 'users', authorId), {
      postsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
  }
}

export async function togglePostLike(post: PostItem, actor: UserProfile, currentlyLiked: boolean) {
  const likeRef = doc(db, 'posts', post.id, 'likes', actor.uid);
  const postRef = doc(db, 'posts', post.id);
  try {
    if (currentlyLiked) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(likeRef, {
        userId: actor.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(postRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        recipientId: post.authorId,
        actor,
        type: 'like',
        targetId: post.id,
        message: `${actor.fullName} liked your post`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/likes/${actor.uid}`);
  }
}

export async function addPostComment(
  post: PostItem,
  actor: UserProfile,
  content: string,
  parentCommentId = ''
) {
  try {
    await addDoc(collection(db, 'posts', post.id, 'comments'), {
      targetId: post.id,
      authorId: actor.uid,
      authorName: actor.fullName,
      authorUsername: actor.username,
      authorAvatar: actor.avatarUrl || '',
      content: content.trim().slice(0, 1000),
      parentCommentId,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'posts', post.id), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      recipientId: post.authorId,
      actor,
      type: parentCommentId ? 'reply' : 'comment',
      targetId: post.id,
      message: `${actor.fullName} commented: "${content.trim().slice(0, 60)}"`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}/comments`);
  }
}

export async function deletePostComment(postId: string, commentId: string) {
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), {
      commentsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
  }
}

export async function incrementPostShare(postId: string) {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      sharesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function toggleSavedItem(
  userId: string,
  targetId: string,
  targetType: 'post' | 'reel',
  currentlySaved: boolean
) {
  const saveId = `${userId}_${targetId}`;
  const ref = doc(db, 'saved_posts', saveId);
  try {
    if (currentlySaved) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        userId,
        targetId,
        targetType,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `saved_posts/${saveId}`);
  }
}

export async function toggleFollow(actor: UserProfile, targetUserId: string, isFollowing: boolean) {
  const followId = `${actor.uid}_${targetUserId}`;
  const ref = doc(db, 'follows', followId);
  try {
    if (isFollowing) {
      await deleteDoc(ref);
      await updateDoc(doc(db, 'users', actor.uid), {
        followingCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        followersCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        followerId: actor.uid,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', actor.uid), {
        followingCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        followersCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        recipientId: targetUserId,
        actor,
        type: 'follow',
        targetId: actor.uid,
        message: `${actor.fullName} started following you`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `follows/${followId}`);
  }
}

export async function sendFriendRequest(actor: UserProfile, targetUserId: string) {
  const reqId = `${actor.uid}_${targetUserId}`;
  try {
    await setDoc(doc(db, 'friend_requests', reqId), {
      fromId: actor.uid,
      toId: targetUserId,
      fromName: actor.fullName,
      fromUsername: actor.username,
      fromAvatar: actor.avatarUrl || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      recipientId: targetUserId,
      actor,
      type: 'friend_request',
      targetId: reqId,
      message: `${actor.fullName} sent you a friend request`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `friend_requests/${reqId}`);
  }
}

export async function respondFriendRequest(
  requestId: string,
  fromId: string,
  actor: UserProfile,
  accept: boolean
) {
  try {
    await updateDoc(doc(db, 'friend_requests', requestId), {
      status: accept ? 'accepted' : 'rejected',
      updatedAt: serverTimestamp(),
    });
    if (accept) {
      const sorted = [fromId, actor.uid].sort();
      const friendshipId = `${sorted[0]}_${sorted[1]}`;
      await setDoc(doc(db, 'friendships', friendshipId), {
        userA: sorted[0],
        userB: sorted[1],
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', actor.uid), {
        friendsCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', fromId), {
        friendsCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        recipientId: fromId,
        actor,
        type: 'friend_accept',
        targetId: actor.uid,
        message: `${actor.fullName} accepted your friend request`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friend_requests/${requestId}`);
  }
}

export async function cancelFriendRequest(fromId: string, toId: string) {
  const reqId = `${fromId}_${toId}`;
  try {
    await deleteDoc(doc(db, 'friend_requests', reqId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `friend_requests/${reqId}`);
  }
}

export async function removeFriendship(uidA: string, uidB: string) {
  const sorted = [uidA, uidB].sort();
  const friendshipId = `${sorted[0]}_${sorted[1]}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
    await updateDoc(doc(db, 'users', uidA), {
      friendsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', uidB), {
      friendsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `friendships/${friendshipId}`);
  }
}

export async function toggleBlockUser(blockerId: string, blockedId: string, currentlyBlocked: boolean) {
  const blockId = `${blockerId}_${blockedId}`;
  try {
    if (currentlyBlocked) {
      await deleteDoc(doc(db, 'blocks', blockId));
    } else {
      await setDoc(doc(db, 'blocks', blockId), {
        blockerId,
        blockedId,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `blocks/${blockId}`);
  }
}

export async function createReel(input: {
  author: UserProfile;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  audioTitle?: string;
}) {
  try {
    const ref = await addDoc(collection(db, 'reels'), {
      authorId: input.author.uid,
      authorName: input.author.fullName,
      authorUsername: input.author.username,
      authorAvatar: input.author.avatarUrl || '',
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl || '',
      caption: input.caption.trim().slice(0, 1000),
      hashtags: extractHashtags(input.caption),
      audioTitle: (input.audioTitle || `Original Audio · ${input.author.fullName}`).slice(0, 120),
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'reels');
  }
}

export async function createStory(input: {
  author: UserProfile;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  visibility: 'public' | 'followers' | 'friends';
}) {
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  try {
    const ref = await addDoc(collection(db, 'stories'), {
      authorId: input.author.uid,
      authorName: input.author.fullName,
      authorUsername: input.author.username,
      authorAvatar: input.author.avatarUrl || '',
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      caption: (input.caption || '').trim().slice(0, 240),
      visibility: input.visibility,
      viewsCount: 0,
      expiresAt,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'stories');
  }
}

export async function recordStoryView(storyId: string, viewer: UserProfile) {
  const viewRef = doc(db, 'stories', storyId, 'views', viewer.uid);
  try {
    const snap = await getDoc(viewRef);
    if (!snap.exists()) {
      await setDoc(viewRef, {
        viewerId: viewer.uid,
        viewerName: viewer.fullName,
        viewerAvatar: viewer.avatarUrl || '',
        viewedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'stories', storyId), {
        viewsCount: increment(1),
      });
    }
  } catch {
    // Non-fatal if story expired
  }
}

export async function getOrCreateDirectConversation(
  actor: UserProfile,
  peer: UserProfile
): Promise<string> {
  const sorted = [actor.uid, peer.uid].sort();
  const directId = `dm_${sorted[0]}_${sorted[1]}`;
  const convRef = doc(db, 'conversations', directId);
  try {
    const snap = await getDoc(convRef);
    if (snap.exists()) return directId;

    const now = serverTimestamp();
    await setDoc(convRef, {
      isGroup: false,
      title: '',
      memberIds: sorted,
      lastMessageText: '',
      lastMessageAt: now,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    });

    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', directId, 'members', actor.uid), {
      uid: actor.uid,
      role: 'admin',
      joinedAt: now,
    });
    batch.set(doc(db, 'conversations', directId, 'members', peer.uid), {
      uid: peer.uid,
      role: 'member',
      joinedAt: now,
    });
    await batch.commit();
    return directId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${directId}`);
  }
}

export async function createGroupConversation(
  creator: UserProfile,
  title: string,
  memberIds: string[]
): Promise<string> {
  const uniqueMembers = Array.from(new Set([creator.uid, ...memberIds])).slice(0, 50);
  const convId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = serverTimestamp();
  try {
    await setDoc(doc(db, 'conversations', convId), {
      isGroup: true,
      title: title.trim().slice(0, 100),
      memberIds: uniqueMembers,
      lastMessageText: '',
      lastMessageAt: now,
      createdBy: creator.uid,
      createdAt: now,
      updatedAt: now,
    });
    const batch = writeBatch(db);
    for (const uid of uniqueMembers) {
      batch.set(doc(db, 'conversations', convId, 'members', uid), {
        uid,
        role: uid === creator.uid ? 'admin' : 'member',
        joinedAt: now,
      });
    }
    await batch.commit();
    return convId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}`);
  }
}

export async function sendChatMessage(input: {
  conversationId: string;
  sender: UserProfile;
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'none' | 'image' | 'video' | 'file';
  replyToId?: string;
  replyToText?: string;
  recipientIds: string[];
}) {
  const now = serverTimestamp();
  try {
    await addDoc(collection(db, 'conversations', input.conversationId, 'messages'), {
      conversationId: input.conversationId,
      senderId: input.sender.uid,
      senderName: input.sender.fullName,
      senderAvatar: input.sender.avatarUrl || '',
      text: input.text.trim().slice(0, 2000),
      attachmentUrl: input.attachmentUrl || '',
      attachmentType: input.attachmentType || 'none',
      replyToId: input.replyToId || '',
      replyToText: (input.replyToText || '').slice(0, 200),
      edited: false,
      deleted: false,
      reactions: {},
      readBy: [input.sender.uid],
      createdAt: now,
      updatedAt: now,
    });
    const preview =
      input.text.trim() ||
      (input.attachmentType && input.attachmentType !== 'none'
        ? `Sent a ${input.attachmentType}`
        : '');
    await updateDoc(doc(db, 'conversations', input.conversationId), {
      lastMessageText: preview.slice(0, 240),
      lastMessageAt: now,
      updatedAt: now,
    });

    for (const rid of input.recipientIds) {
      if (rid !== input.sender.uid) {
        await createNotification({
          recipientId: rid,
          actor: input.sender,
          type: 'message',
          targetId: input.conversationId,
          message: `${input.sender.fullName}: ${preview.slice(0, 80)}`,
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `conversations/${input.conversationId}/messages`);
  }
}

export async function markMessageRead(conversationId: string, messageId: string, uid: string) {
  try {
    await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
      readBy: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

export async function submitReport(input: {
  reporterId: string;
  targetType: ReportItem['targetType'];
  targetId: string;
  category: ReportItem['category'];
  details: string;
}) {
  const now = serverTimestamp();
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category,
      details: input.details.trim().slice(0, 1000),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'reports');
  }
}

export async function createGroup(input: {
  creator: UserProfile;
  name: string;
  description: string;
  category: string;
  privacy: 'public' | 'private';
  coverUrl?: string;
}) {
  const now = serverTimestamp();
  try {
    const ref = await addDoc(collection(db, 'groups'), {
      name: input.name.trim().slice(0, 80),
      description: input.description.trim().slice(0, 600),
      coverUrl: input.coverUrl || '',
      category: input.category.trim().slice(0, 40) || 'Community',
      privacy: input.privacy,
      creatorId: input.creator.uid,
      membersCount: 1,
      postsCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'groups', ref.id, 'members', input.creator.uid), {
      uid: input.creator.uid,
      role: 'admin',
      joinedAt: now,
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'groups');
  }
}

export async function toggleGroupMembership(groupId: string, uid: string, isMember: boolean) {
  const memRef = doc(db, 'groups', groupId, 'members', uid);
  const grpRef = doc(db, 'groups', groupId);
  try {
    if (isMember) {
      await deleteDoc(memRef);
      await updateDoc(grpRef, { membersCount: increment(-1), updatedAt: serverTimestamp() });
    } else {
      await setDoc(memRef, { uid, role: 'member', joinedAt: serverTimestamp() });
      await updateDoc(grpRef, { membersCount: increment(1), updatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/members/${uid}`);
  }
}

export async function logAdminAction(
  actorId: string,
  action: string,
  targetId: string,
  details: string
) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorId,
      action: action.slice(0, 80),
      targetId: targetId.slice(0, 128),
      details: details.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
  }
}

export async function adminUpdateUser(
  adminUid: string,
  targetUid: string,
  patch: Partial<Pick<UserProfile, 'status' | 'isVerified' | 'membershipTier'>>,
  auditSummary: string
) {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(adminUid, 'user_moderation', targetUid, auditSummary);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminAssignRole(
  adminUid: string,
  targetUid: string,
  role: AdminRoleType
) {
  try {
    await setDoc(doc(db, 'admins', targetUid), {
      uid: targetUid,
      role,
      assignedBy: adminUid,
      createdAt: serverTimestamp(),
    });
    await logAdminAction(adminUid, 'assign_admin_role', targetUid, `Assigned role ${role}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${targetUid}`);
  }
}

export async function fetchAllActiveUsers(maxCount = 50): Promise<UserProfile[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('status', '==', 'active'),
      orderBy('followersCount', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch {
    const q = query(collection(db, 'users'), where('status', '==', 'active'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  }
}
