import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAdminClient, resolveEnv, verifyCredentials } from '@supabase/server/core';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = path.resolve('/tmp/skworld_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
};

interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

interface AuthedRequest extends Request {
  authUser?: VerifiedUser;
}

// Server-side presence & typing state
const onlinePresence = new Map<string, { lastSeen: number; showLastSeen: boolean }>();
const typingIndicators = new Map<string, Map<string, { name: string; expiresAt: number }>>();

// Simple rate limiter (per IP + endpoint)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxReq: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxReq) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    bucket.count += 1;
    return next();
  };
}

async function verifyFirebaseBearer(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const idToken = header.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing ID token' });
  }
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
    const data = (await resp.json()) as {
      users?: Array<{ localId: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) {
      return res.status(401).json({ error: 'User not found for token' });
    }
    req.authUser = {
      uid: user.localId,
      email: user.email || '',
      emailVerified: Boolean(user.emailVerified),
    };
    return next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Failed to verify authentication token' });
  }
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signLiveKitJwt(apiKey: string, apiSecret: string, roomName: string, identity: string, name: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      name,
      nbf: now,
      exp: now + 3600,
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    })
  );
  const signature = base64Url(crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

async function startServer() {
  const app = express();

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = new Set([
      'https://localhost',
      'http://localhost',
      'capacitor://localhost',
      process.env.APP_URL,
    ].filter(Boolean) as string[]);
    if (origin && (allowedOrigins.has(origin) || origin.endsWith('.run.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-mime-type, x-file-name, x-bucket, apikey');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/upload', express.raw({ type: '*/*', limit: '52mb' }));
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Honest external integration configuration status
  app.get('/api/config-status', (_req, res) => {
    const liveStreamingConfigured = Boolean(
      process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET
    );
    const paymentsConfigured = Boolean(
      process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
    );
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabasePublishable =
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    res.json({
      liveStreamingConfigured,
      liveStreamingRequiredEnv: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
      paymentsConfigured,
      paymentsRequiredEnv: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_PREMIUM',
        'STRIPE_PRICE_CREATOR_PRO',
      ],
      supabaseStorageConfigured: Boolean(supabaseUrl && supabaseSecret),
      supabasePublishableConfigured: Boolean(supabaseUrl && supabasePublishable),
      supabaseJwksConfigured: Boolean(process.env.SUPABASE_JWKS_URL || supabaseUrl),
      supabaseRequiredEnv: [
        'SUPABASE_URL',
        'SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_SECRET_KEY',
        'SUPABASE_JWKS_URL',
      ],
    });
  });

  // Verify incoming Supabase user JWT via @supabase/server/core JWKS verification
  app.get('/api/supabase/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const apikey = typeof req.headers.apikey === 'string' ? req.headers.apikey : null;
    const { data, error } = await verifyCredentials(
      { token, apikey },
      { auth: 'user' }
    );
    if (error) {
      return res.status(error.status).json(error.toJSON());
    }
    return res.json({
      authenticated: true,
      authMode: data.authMode,
      userClaims: data.userClaims,
    });
  });

  // Secure media upload endpoint (supports images, MP4/WebM videos, PDF attachments)
  app.post('/api/upload', rateLimit(40, 60_000), verifyFirebaseBearer, async (req: AuthedRequest, res) => {
    try {
      const mime = String(req.headers['x-mime-type'] || req.headers['content-type'] || '').split(';')[0].trim();
      const ext = ALLOWED_MIME[mime];
      if (!ext) {
        return res.status(400).json({
          error: 'Unsupported file type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, PDF.',
        });
      }
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'Empty file upload.' });
      }
      const isVideo = mime.startsWith('video/');
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return res.status(413).json({
          error: `File too large. Max size is ${isVideo ? '50MB' : '10MB'}.`,
        });
      }

      const bucket = String(req.headers['x-bucket'] || 'general').replace(/[^a-z0-9_-]/gi, '');
      const filename = `${bucket}_${Date.now()}_${crypto.randomUUID()}${ext}`;

      const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseSecret) {
        const { data: env } = resolveEnv({
          url: supabaseUrl,
          secretKeys: { default: supabaseSecret },
        });
        if (env) {
          const supabaseAdmin = createAdminClient({ env });
          const objectPath = `${bucket}/${filename}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('skworld-media')
            .upload(objectPath, buffer, { contentType: mime, upsert: true });
          if (!uploadError) {
            const { data: publicData } = supabaseAdmin.storage
              .from('skworld-media')
              .getPublicUrl(objectPath);
            return res.status(201).json({
              url: publicData.publicUrl,
              mimeType: mime,
              size: buffer.length,
              storage: 'supabase',
              uploadedBy: req.authUser?.uid,
            });
          }
          console.warn('Supabase Storage upload skipped (falling back to local storage):', uploadError.message);
        }
      }

      const filepath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      return res.status(201).json({
        url: `/api/media/${filename}`,
        mimeType: mime,
        size: buffer.length,
        storage: 'local',
        uploadedBy: req.authUser?.uid,
      });
    } catch (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Failed to store uploaded media.' });
    }
  });

  // Serve uploaded media safely with range support for MP4/WebM streaming
  app.get('/api/media/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filepath = path.join(UPLOAD_DIR, safeName);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Media not found' });
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filepath);
  });

  // LiveKit Token Generation (only when real credentials exist)
  app.post('/api/livekit/token', rateLimit(20, 60_000), verifyFirebaseBearer, (req: AuthedRequest, res) => {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      return res.status(503).json({
        configured: false,
        error: 'Live streaming provider credentials are not configured on the server.',
        requiredEnv: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
      });
    }
    const { roomName, participantName } = req.body as { roomName?: string; participantName?: string };
    if (!roomName || typeof roomName !== 'string') {
      return res.status(400).json({ error: 'roomName is required' });
    }
    const token = signLiveKitJwt(
      apiKey,
      apiSecret,
      roomName.slice(0, 64),
      req.authUser!.uid,
      (participantName || 'SK World Member').slice(0, 60)
    );
    return res.json({ configured: true, url, token });
  });

  // Stripe Checkout Session Creation (real Stripe REST API)
  app.post('/api/stripe/checkout', rateLimit(10, 60_000), verifyFirebaseBearer, async (req: AuthedRequest, res) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const { plan } = req.body as { plan?: 'premium' | 'creator_pro' };
    if (!secretKey) {
      return res.status(503).json({
        configured: false,
        error: 'Stripe payment gateway credentials are not configured on the server.',
        requiredEnv: [
          'STRIPE_SECRET_KEY',
          'STRIPE_WEBHOOK_SECRET',
          'STRIPE_PRICE_PREMIUM',
          'STRIPE_PRICE_CREATOR_PRO',
        ],
      });
    }
    const priceId =
      plan === 'creator_pro' ? process.env.STRIPE_PRICE_CREATOR_PRO : process.env.STRIPE_PRICE_PREMIUM;
    if (!priceId) {
      return res.status(503).json({
        configured: false,
        error: 'Stripe price ID for the selected plan is not configured.',
        requiredEnv: ['STRIPE_PRICE_PREMIUM', 'STRIPE_PRICE_CREATOR_PRO'],
      });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/premium?checkout=success`,
      cancel_url: `${appUrl}/premium?checkout=cancelled`,
      client_reference_id: req.authUser!.uid,
      customer_email: req.authUser!.email || '',
    });

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const session = (await stripeRes.json()) as { url?: string; error?: { message: string } };
      if (!stripeRes.ok || !session.url) {
        return res.status(400).json({ error: session.error?.message || 'Stripe checkout failed' });
      }
      return res.json({ configured: true, url: session.url });
    } catch (err) {
      console.error('Stripe checkout error:', err);
      return res.status(500).json({ error: 'Payment gateway communication failed.' });
    }
  });

  // Stripe Webhook with HMAC signature verification
  app.post('/api/stripe/webhook', (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: 'Stripe webhook secret not configured' });
    }
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }
    const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=')));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) {
      return res.status(400).json({ error: 'Malformed signature header' });
    }
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${payload}`).digest('hex');
    if (expected !== v1) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    return res.json({ received: true });
  });

  // Presence & Typing Indicators
  app.post('/api/presence/heartbeat', verifyFirebaseBearer, (req: AuthedRequest, res) => {
    const showLastSeen = req.body?.showLastSeen !== false;
    onlinePresence.set(req.authUser!.uid, { lastSeen: Date.now(), showLastSeen });
    res.json({ ok: true });
  });

  app.get('/api/presence', verifyFirebaseBearer, (req, res) => {
    const ids = String(req.query.uids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    const now = Date.now();
    const result: Record<string, { online: boolean; lastSeen: number | null }> = {};
    for (const uid of ids) {
      const entry = onlinePresence.get(uid);
      if (!entry || !entry.showLastSeen) {
        result[uid] = { online: false, lastSeen: null };
      } else {
        result[uid] = {
          online: now - entry.lastSeen < 45_000,
          lastSeen: entry.lastSeen,
        };
      }
    }
    res.json(result);
  });

  app.post('/api/typing', verifyFirebaseBearer, (req: AuthedRequest, res) => {
    const { conversationId, name, isTyping } = req.body as {
      conversationId?: string;
      name?: string;
      isTyping?: boolean;
    };
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (!typingIndicators.has(conversationId)) {
      typingIndicators.set(conversationId, new Map());
    }
    const map = typingIndicators.get(conversationId)!;
    if (isTyping) {
      map.set(req.authUser!.uid, { name: String(name || 'Someone').slice(0, 40), expiresAt: Date.now() + 5000 });
    } else {
      map.delete(req.authUser!.uid);
    }
    return res.json({ ok: true });
  });

  app.get('/api/typing/:conversationId', verifyFirebaseBearer, (req: AuthedRequest, res) => {
    const map = typingIndicators.get(req.params.conversationId);
    const now = Date.now();
    const active: Array<{ uid: string; name: string }> = [];
    if (map) {
      for (const [uid, info] of map.entries()) {
        if (info.expiresAt > now && uid !== req.authUser!.uid) {
          active.push({ uid, name: info.name });
        } else if (info.expiresAt <= now) {
          map.delete(uid);
        }
      }
    }
    res.json({ typing: active });
  });

  // Vite dev middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    // HMR is disabled in AI Studio; serve a WebSocket-free @vite/client shim
    // so CSS injection and module hot context calls work without WS errors.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript');
      res.send(`const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    prune() {},
    dispose() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const parsed = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (parsed.search ? '&' + parsed.search.slice(1) : '') + (parsed.hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SK World server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
