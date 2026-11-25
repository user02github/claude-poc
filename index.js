const express = require('express');
const os = require('os');
const { rateLimit } = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 10;
const MAX_MESSAGE_LENGTH = 1000;
const ALLOWED_ECHO_FIELDS = ['message'];

function validateEchoBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Body muss ein JSON-Objekt sein'] };
  }

  const errors = [];

  const unknown = Object.keys(body).filter((key) => !ALLOWED_ECHO_FIELDS.includes(key));
  if (unknown.length > 0) {
    errors.push(`Unbekannte Felder: ${unknown.join(', ')}`);
  }

  if (!('message' in body)) {
    errors.push('Feld "message" fehlt');
  } else if (typeof body.message !== 'string') {
    errors.push('Feld "message" muss ein String sein');
  } else {
    const trimmed = body.message.trim();
    if (trimmed.length === 0) {
      errors.push('Feld "message" darf nicht leer sein');
    } else if (trimmed.length > MAX_MESSAGE_LENGTH) {
      errors.push(`Feld "message" darf höchstens ${MAX_MESSAGE_LENGTH} Zeichen lang sein`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, value: { message: body.message.trim() } };
}

function createApiLimiter({ windowMs = RATE_LIMIT_WINDOW_MS, limit = RATE_LIMIT_MAX } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: 'Zu viele Anfragen, bitte später erneut versuchen' });
    },
  });
}

// Jede App-Instanz bekommt einen eigenen Limiter-Zähler (wichtig für isolierte Tests)
function createApp({ rateLimit: rateLimitOptions } = {}) {
  const app = express();

  // Limiter vor dem JSON-Parser: geblockte Anfragen werden gar nicht erst geparst
  app.use('/api', createApiLimiter(rateLimitOptions));
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (req, res) => {
    try {
      res.status(200).send('Hello from Claude Code in Ubuntu!');
    } catch (err) {
      console.error('Fehler in GET /:', err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  app.get('/info', (req, res) => {
    try {
      res.status(200).json({
        nodeVersion: process.version,
        platform: os.platform(),
        os: os.type(),
        release: os.release(),
        arch: os.arch(),
      });
    } catch (err) {
      console.error('Fehler in GET /info:', err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  app.get('/health', (req, res) => {
    try {
      res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Fehler in GET /health:', err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  app.post('/api/echo', (req, res) => {
    try {
      if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type muss application/json sein' });
      }

      const result = validateEchoBody(req.body);
      if (!result.valid) {
        return res.status(400).json({ error: 'Ungültige Eingabe', details: result.errors });
      }

      return res.status(200).json({
        echo: result.value,
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Fehler in POST /api/echo:', err);
      return res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  // Aktuelle Serverzeit: ISO-8601 (UTC), Unix-Zeit in ms und Zeitzone des Servers
  app.get('/time', (req, res) => {
    try {
      const now = new Date();
      res.status(200).json({
        time: now.toISOString(),
        unixMs: now.getTime(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (err) {
      console.error('Fehler in GET /time:', err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  // Fehler aus express.json() (kaputtes JSON, zu großer Body) als JSON statt HTML beantworten
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Ungültiges JSON' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request-Body zu groß (max. 10kb)' });
    }
    console.error('Unbehandelter Fehler:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
module.exports.validateEchoBody = validateEchoBody;
