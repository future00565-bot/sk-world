import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type {
  AdminRoleType,
  UserPrivateInfo,
  UserProfile,
} from '../types/skworld';
import { apiUrl } from '../lib/apiBase';
import { useTheme } from './ThemeContext';
import { useLanguage } from './LanguageContext';

interface OnboardingInput {
  fullName: string;
  username: string;
  phone?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  adminRole: AdminRoleType | null;
  authReady: boolean;
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  privateInfo: null,
  adminRole: null,
  authReady: false,
  needsOnboarding: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendResetEmail: async () => {},
  resendVerificationEmail: async () => {},
  completeOnboarding: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  getIdToken: async () => null,
});

const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'sunon00565@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRoleType | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const { setTheme } = useTheme();
  const { setLanguage } = useLanguage();

  useEffect(() => {
    void getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setPrivateInfo(null);
        setAdminRole(null);
        setProfileLoaded(true);
        setAuthReady(true);
      } else {
        setProfileLoaded(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const uid = firebaseUser.uid;
    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileLoaded(true);
      },
      (err) => {
        setProfileLoaded(true);
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubPrivate = firebaseUser.emailVerified
      ? onSnapshot(
          doc(db, 'users', uid, 'private', 'info'),
          (snap) => {
            if (snap.exists()) {
              const info = snap.data() as UserPrivateInfo;
              setPrivateInfo(info);
              if (info.theme) setTheme(info.theme);
              if (info.language) setLanguage(info.language);
            } else {
              setPrivateInfo(null);
            }
          },
          () => {
            // Silently ignore if document doesn't exist yet during onboarding
          }
        )
      : () => {};

    const checkAdmin = async () => {
      if (firebaseUser.email === BOOTSTRAP_SUPER_ADMIN_EMAIL && firebaseUser.emailVerified) {
        setAdminRole('super_admin');
        return;
      }
      if (!firebaseUser.emailVerified) {
        setAdminRole(null);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, 'admins', uid));
        if (adminSnap.exists()) {
          setAdminRole((adminSnap.data() as { role: AdminRoleType }).role);
        } else {
          setAdminRole(null);
        }
      } catch {
        setAdminRole(null);
      }
    };
    void checkAdmin();

    return () => {
      unsubProfile();
      unsubPrivate();
    };
  }, [firebaseUser, setLanguage, setTheme]);

  // Real-time online presence heartbeat
  useEffect(() => {
    if (!firebaseUser || !profile) return;
    let active = true;
    const beat = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        if (!active) return;
        await fetch(apiUrl('/api/presence/heartbeat'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ showLastSeen: privateInfo?.showLastSeen ?? true }),
        });
      } catch {
        // Ignore transient network drops
      }
    };
    void beat();
    const id = window.setInterval(beat, 25_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [firebaseUser, profile, privateInfo?.showLastSeen]);

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      await signInWithRedirect(auth, googleAuthProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
  };

  const sendResetEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const completeOnboarding = async (input: OnboardingInput) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const uid = auth.currentUser.uid;
    const cleanUsername = input.username.trim().toLowerCase();

    const usernameDocRef = doc(db, 'usernames', cleanUsername);
    const existingUsername = await getDoc(usernameDocRef);
    if (existingUsername.exists()) {
      throw new Error('This username is already taken. Please choose another.');
    }

    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, 'users', uid), {
      uid,
      username: cleanUsername,
      fullName: input.fullName.trim().slice(0, 80),
      bio: '',
      avatarUrl: input.avatarUrl || auth.currentUser.photoURL || '',
      coverUrl: '',
      location: '',
      website: '',
      isPrivate: false,
      isVerified: false,
      membershipTier: 'free',
      status: 'active',
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      postsCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'users', uid, 'private', 'info'), {
      uid,
      email: auth.currentUser.email || '',
      phone: input.phone?.trim() || '',
      dateOfBirth: input.dateOfBirth || '',
      allowMessagesFrom: 'everyone',
      showLastSeen: true,
      language: 'en',
      theme: 'light',
      termsAcceptedAt: new Date().toISOString(),
      updatedAt: now,
    });

    batch.set(usernameDocRef, {
      uid,
      createdAt: now,
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const batch = writeBatch(db);
    if (profile?.username) {
      batch.delete(doc(db, 'usernames', profile.username));
    }
    batch.delete(doc(db, 'users', uid, 'private', 'info'));
    await batch.commit();
    await deleteUser(auth.currentUser);
  };

  const getIdToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const needsOnboarding = Boolean(
    firebaseUser && firebaseUser.emailVerified && profileLoaded && !profile
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateInfo,
        adminRole,
        authReady,
        needsOnboarding,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendResetEmail,
        resendVerificationEmail,
        completeOnboarding,
        logout,
        deleteAccount,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
