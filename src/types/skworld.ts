export type ThemeMode = 'light' | 'dark' | 'system';
export type LanguageCode = 'en' | 'bn';
export type MembershipTier = 'free' | 'premium' | 'creator_pro';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type AdminRoleType = 'super_admin' | 'admin' | 'moderator' | 'support';
export type VisibilityType = 'public' | 'followers' | 'friends' | 'private';

export const VALIDATION_LIMITS = {
  USERNAME_REGEX: /^[a-zA-Z0-9_]{3,30}$/,
  FULL_NAME_MAX: 80,
  BIO_MAX: 300,
  LOCATION_MAX: 100,
  WEBSITE_MAX: 200,
  POST_CONTENT_MAX: 5000,
  COMMENT_MAX: 1000,
  REEL_CAPTION_MAX: 1000,
  STORY_CAPTION_MAX: 240,
  MESSAGE_MAX: 2000,
  GROUP_NAME_MAX: 80,
  GROUP_DESC_MAX: 600,
  REPORT_DETAILS_MAX: 1000,
} as const;

export interface UserProfile {
  uid: string;
  username: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  isPrivate: boolean;
  isVerified: boolean;
  membershipTier: MembershipTier;
  status: AccountStatus;
  followersCount: number;
  followingCount: number;
  friendsCount: number;
  postsCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  allowMessagesFrom: 'everyone' | 'followers' | 'friends';
  showLastSeen: boolean;
  language: LanguageCode;
  theme: ThemeMode;
  termsAcceptedAt?: string;
  updatedAt: unknown;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  content: string;
  mediaUrls: string[];
  mediaType: 'text' | 'image' | 'video';
  hashtags: string[];
  taggedUserIds?: string[];
  location?: string;
  visibility: VisibilityType;
  groupId?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CommentItem {
  id: string;
  targetId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  parentCommentId?: string;
  createdAt: unknown;
}

export interface ReelItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  hashtags: string[];
  audioTitle?: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  sharesCount: number;
  createdAt: unknown;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  visibility: 'public' | 'followers' | 'friends';
  viewsCount: number;
  expiresAt: unknown;
  createdAt: unknown;
}

export interface StoryViewItem {
  viewerId: string;
  viewerName?: string;
  viewerAvatar?: string;
  viewedAt: unknown;
}

export interface FriendRequestItem {
  id: string;
  fromId: string;
  toId: string;
  fromName?: string;
  fromUsername?: string;
  fromAvatar?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ConversationItem {
  id: string;
  isGroup: boolean;
  title?: string;
  memberIds: string[];
  lastMessageText?: string;
  lastMessageAt?: unknown;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  attachmentUrl?: string;
  attachmentType: 'none' | 'image' | 'video' | 'file';
  replyToId?: string;
  replyToText?: string;
  edited: boolean;
  deleted: boolean;
  reactions?: Record<string, string[]>;
  readBy: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
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
  isRead: boolean;
  createdAt: unknown;
}

export interface GroupItem {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
  category?: string;
  privacy: 'public' | 'private';
  creatorId: string;
  membersCount: number;
  postsCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface LiveStreamItem {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  title: string;
  thumbnailUrl?: string;
  status: 'live' | 'ended';
  viewerCount: number;
  createdAt: unknown;
  endedAt?: unknown;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'post' | 'reel' | 'comment' | 'profile' | 'message' | 'group' | 'story' | 'stream';
  targetId: string;
  category:
    | 'spam'
    | 'harassment'
    | 'bullying'
    | 'violence'
    | 'sexual_content'
    | 'impersonation'
    | 'copyright'
    | 'other';
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: unknown;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  details?: string;
  createdAt: unknown;
}
