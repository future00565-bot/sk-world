# SK World — Setup & Deployment Guide

**Tagline:** Connect. Share. Explore. Together.

## Architecture Overview
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7, Lucide Icons, `vite-plugin-pwa`.
- **Backend Server (`server.ts`):** Express + Vite middleware running on port `3000` with Firebase Identity Toolkit Bearer verification, rate-limited media upload/streaming (`/api/upload`, `/api/media/:filename`), real-time presence/typing indicators, LiveKit JWT generation, and Stripe Checkout + Webhook signature verification.
- **Database & Auth:** Cloud Firestore (deployed with hardened Eight-Pillar `firestore.rules`) and Firebase Authentication.

## Local & Production Environment Variables
Configure secrets via your deployment environment (see `.env.example`):

- `APP_URL`: Public origin URL used for Stripe redirect URLs and callbacks.
- `GEMINI_API_KEY`: Optional server-side Gemini API key.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: Required to enable live WebRTC video streaming in `/live`. (Live rooms & Firestore chat work out of the box.)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_CREATOR_PRO`: Required to enable live subscription checkout in `/premium`.

## Firebase Authentication Methods
- **Google Sign-In:** Enabled via Firebase Auth popup.
- **Email / Password Sign-In:** If you want Email/Password registration alongside Google Sign-In, enable the **Email/Password** provider in Firebase Console -> Authentication -> Sign-in method.
- **Super Admin Console (`/admin`):** Bootstrapped for verified admin email `sunon00565@gmail.com`, which can assign `admin`, `moderator`, or `support` roles to other members inside `/admin`.

## Commands
- `npm run dev` — Start full-stack Express + Vite server on port `3000`.
- `npm run lint` — Run TypeScript type check (`tsc --noEmit`).
- `npm run build` — Build production client + PWA service worker into `dist/`.
- `npm run start` — Serve production build with `server.ts`.
- `npx eslint firestore.rules` — Validate Firestore security rules.
- `npx tsx --test tests/skworld.test.ts` — Run automated platform verification tests.

## Android Packaging Note
SK World is an installable Progressive Web App (PWA) supporting iOS Safari ("Add to Home Screen") and Android/Desktop Chromium install prompts. Installing as a PWA does **not** produce an `.apk`/`.aab` binary; if you want a Google Play Store Android package, wrap the built `dist/` bundle using **Capacitor** (`@capacitor/android`) or **Trusted Web Activity (Bubblewrap)**.
