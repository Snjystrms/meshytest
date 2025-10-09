/**
 * Express Proxy Server for Meshy API (v2) + Asset CORS Proxy
 *
 * .env (in /server):
 *   MESHY_API_KEY=msy_...
 *   MESHY_BASE_URL=https://api.meshy.ai
 *   PORT=8787
 *
 * Frontend .env:
 *   VITE_USE_PROXY=true
 *   VITE_MESHY_BASE_URL=https://api.meshy.ai
 *
 * Run:
 *   node index.js
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Readable } from 'node:stream';

const app = express();
const PORT = process.env.PORT || 8787;
const MESHY_BASE_URL = process.env.MESHY_BASE_URL || 'https://api.meshy.ai';
const MESHY_API_KEY = process.env.MESHY_API_KEY;

if (!MESHY_API_KEY) {
  console.error('ERROR: MESHY_API_KEY is not set in environment variables');
  process.exit(1);
}

// --- Middleware ---
app.use(cors({
  origin: [/^http:\/\/localhost:\d+$/],
  credentials: false,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Generic asset proxy to bypass CDN CORS:
 * GET /api/meshy/asset?url=<encoded assets.meshy.ai URL>
 */
app.get('/api/meshy/asset', async (req, res) => {
  try {
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const url = decodeURIComponent(raw);

    const allowed = /^https:\/\/assets\.meshy\.ai\/.+/i.test(url);
    if (!allowed) {
      return res.status(400).json({ error: 'Invalid URL - must be from assets.meshy.ai' });
    }

    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('Meshy asset fetch error:', r.status, body);
      return res.status(r.status).end();
    }

    const type = r.headers.get('content-type') || 'application/octet-stream';
    const len  = r.headers.get('content-length') || undefined;
    res.set({
      'Content-Type': type,
      ...(len ? { 'Content-Length': len } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });

    if (r.body) {
      Readable.fromWeb(r.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error('Asset proxy error:', err);
    res.status(500).json({ error: 'asset_proxy_failed', message: String(err?.message || err) });
  }
});

/**
 * Create Text-to-3D task
 */
app.post('/api/meshy/openapi/v2/text-to-3d', async (req, res) => {
  try {
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v2/text-to-3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

/**
 * Get Text-to-3D task
 */
app.get('/api/meshy/openapi/v2/text-to-3d/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v2/text-to-3d/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

/**
 * Stream Text-to-3D task updates (SSE)
 */
app.get('/api/meshy/openapi/v2/text-to-3d/:id/stream', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const controller = new AbortController();
  const url = `${MESHY_BASE_URL}/openapi/v2/text-to-3d/${id}/stream`;

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorData.message || upstream.statusText })}\n\n`);
      return res.end();
    }

    if (!upstream.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'No response body' })}\n\n`);
      return res.end();
    }

    const nodeStream = Readable.fromWeb(upstream.body);

    nodeStream.on('data', (chunk) => {
      res.write(chunk);
    });

    nodeStream.on('end', () => {
      res.end();
    });

    nodeStream.on('error', (err) => {
      console.error('Upstream stream error:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: String(err?.message || err) })}\n\n`);
      } finally {
        res.end();
      }
    });

    req.on('close', () => {
      try { nodeStream.destroy(); } catch {}
      controller.abort();
    });
  } catch (error) {
    console.error('Stream proxy error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(error?.message || error) })}\n\n`);
    res.end();
  }
});

/**
 * Image-to-3D routes
 */
app.post('/api/meshy/openapi/v1/image-to-3d', async (req, res) => {
  try {
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/image-to-3d/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.delete('/api/meshy/openapi/v1/image-to-3d/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.status(204).end();
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/image-to-3d', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const url = `${MESHY_BASE_URL}/openapi/v1/image-to-3d${queryParams ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

/**
 * Rigging routes
 */
app.post('/api/meshy/openapi/v1/rigging', async (req, res) => {
  try {
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/rigging`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/rigging/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/rigging/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.delete('/api/meshy/openapi/v1/rigging/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/rigging/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.status(204).end();
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/rigging/:id/stream', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const controller = new AbortController();
  const url = `${MESHY_BASE_URL}/openapi/v1/rigging/${id}/stream`;

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorData.message || upstream.statusText })}\n\n`);
      return res.end();
    }

    if (!upstream.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'No response body' })}\n\n`);
      return res.end();
    }

    const nodeStream = Readable.fromWeb(upstream.body);

    nodeStream.on('data', (chunk) => {
      res.write(chunk);
    });

    nodeStream.on('end', () => {
      res.end();
    });

    nodeStream.on('error', (err) => {
      console.error('Upstream stream error:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: String(err?.message || err) })}\n\n`);
      } finally {
        res.end();
      }
    });

    req.on('close', () => {
      try { nodeStream.destroy(); } catch {}
      controller.abort();
    });
  } catch (error) {
    console.error('Stream proxy error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(error?.message || error) })}\n\n`);
    res.end();
  }
});

/**
 * Animation routes
 */
app.post('/api/meshy/openapi/v1/animations', async (req, res) => {
  try {
    console.log('Received animation request:', req.body);
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/animations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    console.log('Meshy API response status:', response.status);
    const data = await response.json();
    console.log('Meshy API response data:', data);
    
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/animations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/animations/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.delete('/api/meshy/openapi/v1/animations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${MESHY_BASE_URL}/openapi/v1/animations/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Meshy API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    res.status(204).end();
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error', message: error.message });
  }
});

app.get('/api/meshy/openapi/v1/animations/:id/stream', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const controller = new AbortController();
  const url = `${MESHY_BASE_URL}/openapi/v1/animations/${id}/stream`;

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorData.message || upstream.statusText })}\n\n`);
      return res.end();
    }

    if (!upstream.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'No response body' })}\n\n`);
      return res.end();
    }

    const nodeStream = Readable.fromWeb(upstream.body);

    nodeStream.on('data', (chunk) => {
      res.write(chunk);
    });

    nodeStream.on('end', () => {
      res.end();
    });

    nodeStream.on('error', (err) => {
      console.error('Upstream stream error:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: String(err?.message || err) })}\n\n`);
      } finally {
        res.end();
      }
    });

    req.on('close', () => {
      try { nodeStream.destroy(); } catch {}
      controller.abort();
    });
  } catch (error) {
    console.error('Stream proxy error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(error?.message || error) })}\n\n`);
    res.end();
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start
app.listen(PORT, () => {
  console.log(`✅ Meshy proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying to: ${MESHY_BASE_URL}`);
  console.log(`🔑 API Key configured: ${MESHY_API_KEY ? 'Yes' : 'No'}`);
});