import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Save } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { Avatar } from '../components/Avatar';

export const EditProfilePage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(profile?.coverUrl || '');
  const [isPrivate, setIsPrivate] = useState(Boolean(profile?.isPrivate));
  const [syncedUid, setSyncedUid] = useState<string | null>(profile?.uid || null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && syncedUid !== profile.uid) {
      setFullName(profile.fullName || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setAvatarUrl(profile.avatarUrl || '');
      setCoverUrl(profile.coverUrl || '');
      setIsPrivate(Boolean(profile.isPrivate));
      setSyncedUid(profile.uid);
    }
  }, [profile, syncedUid]);

  if (!profile) return null;

  const handleUpload = async (file: File, kind: 'avatar' | 'cover') => {
    if (kind === 'avatar') setUploadingAvatar(true);
    else setUploadingCover(true);
    try {
      const res = await uploadMediaFile(file, kind === 'avatar' ? 'avatars' : 'covers');
      if (kind === 'avatar') setAvatarUrl(res.url);
      else setCoverUrl(res.url);
      showToast(`${kind === 'avatar' ? 'Profile picture' : 'Cover photo'} updated`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      if (kind === 'avatar') setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        fullName: fullName.trim().slice(0, 80),
        bio: bio.trim().slice(0, 300),
        location: location.trim().slice(0, 100),
        website: website.trim().slice(0, 200),
        avatarUrl,
        coverUrl,
        isPrivate,
        updatedAt: serverTimestamp(),
      });
      showToast('Profile saved successfully!', 'success');
      navigate(`/profile/${profile.username}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Edit Profile
        </h1>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">Cover Photo</label>
          <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <img
              src={coverUrl || '/src/assets/images/community_cover_photo_1795185891821.jpg'}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <label className="absolute bottom-3 right-3 cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-black/65 text-white px-3 py-1.5 text-xs font-medium">
              <Camera className="w-3.5 h-3.5" /> {uploadingCover ? 'Uploading...' : 'Change Cover'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], 'cover')}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl} name={fullName || profile.fullName} size="lg" />
          <label className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
            {uploadingAvatar ? 'Uploading...' : 'Change Profile Picture'}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], 'avatar')}
              className="hidden"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Bio</label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell SK World about yourself..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
              <input
                type="text"
                maxLength={100}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dhaka, Bangladesh"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Website</label>
              <input
                type="text"
                maxLength={200}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 cursor-pointer">
            <div>
              <p className="text-sm font-semibold">Private Profile</p>
              <p className="text-xs text-slate-500">Restrict full profile details to followers and friends.</p>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
