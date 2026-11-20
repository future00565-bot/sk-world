# SK World Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: Every user-authored document (`posts`, `reels`, `stories`, `comments`, `messages`, `reports`, `blocks`, `saved_posts`) MUST bind `authorId` / `senderId` / `reporterId` / `userId` to `request.auth.uid`.
2. **PII Isolation**: Sensitive fields (`email`, `phone`, `dateOfBirth`, private preferences) live exclusively in `/users/{userId}/private/info` and are readable/writable ONLY by `userId == request.auth.uid` or verified Admin.
3. **Privilege Escalation Prevention**: Users creating `/users/{userId}` MUST initialize `isVerified == false`, `membershipTier == 'free'`, and `status == 'active'`. Only verified Admins can modify `isVerified`, `membershipTier`, `status`, or `/admins/{userId}`.
4. **Master Gate Membership**: Access to `/conversations/{cid}/messages/{mid}` requires membership in `/conversations/{cid}/members/{uid}`. Access to private group posts requires group membership.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`; `createdAt` and `authorId` are immutable on update.
6. **Story Expiration**: Non-author reads of `/stories/{storyId}` require `resource.data.expiresAt > request.time`. Viewer lists (`/stories/{storyId}/views`) are readable ONLY by the story author or the specific viewer.
7. **Verified Email Mandate**: All mutations require `request.auth.token.email_verified == true`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Self-Verification Escalation**: `POST /users/{uid}` with `isVerified: true` or `membershipTier: 'creator_pro'`.
2. **PII Read Leak**: Authenticated user A reading `/users/{userB}/private/info`.
3. **Author Spoofing**: User A creating `/posts/{pid}` with `authorId: userB`.
4. **Shadow Field Injection**: Updating `/posts/{pid}` with `{ content: 'ok', isAdminFeatured: true }`.
5. **Post Counter Tampering**: Non-author updating `likesCount` directly without atomic action allowlist or bypassing valid state.
6. **Unverified Email Spoof**: Request where `request.auth.token.email == 'sunon00565@gmail.com'` and `email_verified == false`.
7. **ID Poisoning**: Creating document with 500-character invalid ID `/posts/a!@#...`.
8. **Unauthorized Chat Eavesdrop**: User C listing `/conversations/{cid}/messages` without being in `/conversations/{cid}/members/userC`.
9. **Story Viewer Snooping**: Non-author User B listing `/stories/{sid}/views`.
10. **Expired Story Access**: User B fetching `/stories/{sid}` where `expiresAt <= request.time`.
11. **Self-Admin Grant**: Regular user writing `/admins/{uid}` with `role: 'super_admin'`.
12. **Audit Log Tampering**: Non-admin reading or deleting `/audit_logs/{logId}`.
