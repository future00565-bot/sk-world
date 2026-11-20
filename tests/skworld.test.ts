import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VALIDATION_LIMITS } from '../src/types/skworld';
import { TRANSLATIONS } from '../src/lib/i18n';

test('Username validation regex accepts valid handles and rejects invalid ones', () => {
  assert.equal(VALIDATION_LIMITS.USERNAME_REGEX.test('ariyan_sk99'), true);
  assert.equal(VALIDATION_LIMITS.USERNAME_REGEX.test('sk'), false);
  assert.equal(VALIDATION_LIMITS.USERNAME_REGEX.test('bad handle!'), false);
  assert.equal(VALIDATION_LIMITS.USERNAME_REGEX.test('a'.repeat(31)), false);
});

test('English and Bengali translation dictionaries maintain exact key parity', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  const bnKeys = Object.keys(TRANSLATIONS.bn).sort();
  assert.deepEqual(enKeys, bnKeys);
  for (const key of enKeys) {
    assert.ok(TRANSLATIONS.bn[key].trim().length > 0, `Missing Bengali translation for ${key}`);
  }
});

test('Firestore security rules maintain default-deny and PII isolation', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert.ok(rules.includes('allow read, write: if false;'), 'Global safety net missing');
  assert.ok(rules.includes('match /private/{docId}'), 'Private PII subcollection missing');
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Email verification gate missing');
  assert.ok(rules.includes('existing().expiresAt > request.time'), '24h Story expiration enforcement missing');
});

test('PWA public assets exist for manifest and iOS Apple touch icon', () => {
  const required = [
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/pwa-maskable-512x512.png',
    'public/apple-touch-icon.png',
    'public/offline.html',
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(path.resolve(file)), `Missing PWA asset: ${file}`);
  }
});

test('All required 20+ SK World routes are registered in App.tsx', () => {
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  const expectedRoutes = [
    'path="/"',
    'path="/explore"',
    'path="/reels"',
    'path="/stories"',
    'path="/friends"',
    'path="/messages"',
    'path="/notifications"',
    'path="/profile"',
    'path="/profile/:username"',
    'path="/settings/profile"',
    'path="/create"',
    'path="/post/:postId"',
    'path="/search"',
    'path="/groups"',
    'path="/saved"',
    'path="/live"',
    'path="/creator"',
    'path="/premium"',
    'path="/settings"',
    'path="/privacy"',
    'path="/help"',
    'path="/about"',
    'path="/terms"',
    'path="/privacy-policy"',
    'path="/admin"',
  ];
  for (const route of expectedRoutes) {
    assert.ok(appSource.includes(route), `Missing route in App.tsx: ${route}`);
  }
});
