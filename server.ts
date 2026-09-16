import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory store for collaborative trips (persists during server lifetime, client also saves in localStorage/IndexedDB)
const tripsStore = new Map<string, any>();
const tripSubscribers = new Map<string, Set<Response>>();

// Broadcast update to all real-time companion subscribers
function broadcastTripUpdate(tripId: string, payload: any, senderSessionId?: string) {
  const subscribers = tripSubscribers.get(tripId);
  if (!subscribers) return;

  const message = `data: ${JSON.stringify({ ...payload, senderSessionId, timestamp: Date.now() })}\n\n`;
  subscribers.forEach((res) => {
    try {
      res.write(message);
    } catch {
      subscribers.delete(res);
    }
  });
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Trip by ID
app.get('/api/trips/:id', (req: Request, res: Response) => {
  const tripId = req.params.id;
  const trip = tripsStore.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  return res.json({ trip });
});

// Save or Update Trip
app.post('/api/trips/:id', (req: Request, res: Response) => {
  const tripId = req.params.id;
  const { trip, sessionId } = req.body;
  if (!trip) {
    return res.status(400).json({ error: 'Missing trip data' });
  }

  const updatedTrip = {
    ...trip,
    id: tripId,
    updatedAt: new Date().toISOString(),
  };

  tripsStore.set(tripId, updatedTrip);

  // Real-time broadcast to all other companion listeners
  broadcastTripUpdate(tripId, { type: 'TRIP_UPDATED', trip: updatedTrip }, sessionId);

  return res.json({ success: true, trip: updatedTrip });
});

// Real-time companion presence ping
app.post('/api/trips/:id/presence', (req: Request, res: Response) => {
  const tripId = req.params.id;
  const { companion, sessionId } = req.body;

  if (companion) {
    broadcastTripUpdate(
      tripId,
      {
        type: 'COMPANION_PRESENCE',
        companion,
      },
      sessionId
    );
  }

  return res.json({ success: true });
});

// Server-Sent Events (SSE) for real-time companion synchronization
app.get('/api/trips/:id/stream', (req: Request, res: Response) => {
  const tripId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!tripSubscribers.has(tripId)) {
    tripSubscribers.set(tripId, new Set());
  }
  const set = tripSubscribers.get(tripId)!;
  set.add(res);

  // Send initial connection acknowledgement
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', tripId })}\n\n`);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      set.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    set.delete(res);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trip Planner server running on http://localhost:${PORT}`);
  });
}

startServer();
