const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function postEcho(baseUrl) {
  return fetch(`${baseUrl}/api/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hallo' }),
  });
}

describe('Rate-Limiting für /api', () => {
  test('nach Erreichen des Limits → 429 mit Retry-After', async () => {
    await withServer(createApp({ rateLimit: { limit: 3, windowMs: 60_000 } }), async (baseUrl) => {
      for (let i = 0; i < 3; i++) {
        const res = await postEcho(baseUrl);
        assert.equal(res.status, 200, `Anfrage ${i + 1} sollte durchgehen`);
        assert.ok(res.headers.get('ratelimit'), 'RateLimit-Header fehlt');
      }

      const blocked = await postEcho(baseUrl);
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get('retry-after'), 'Retry-After-Header fehlt');
      assert.deepEqual(await blocked.json(), {
        error: 'Zu viele Anfragen, bitte später erneut versuchen',
      });
    });
  });

  test('auch ungültige Anfragen zählen gegen das Limit', async () => {
    await withServer(createApp({ rateLimit: { limit: 1 } }), async (baseUrl) => {
      const bad = await fetch(`${baseUrl}/api/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{kaputt',
      });
      assert.equal(bad.status, 400);
      assert.equal((await postEcho(baseUrl)).status, 429);
    });
  });

  test('Routen außerhalb von /api sind nicht begrenzt', async () => {
    await withServer(createApp({ rateLimit: { limit: 1 } }), async (baseUrl) => {
      assert.equal((await postEcho(baseUrl)).status, 200);
      assert.equal((await postEcho(baseUrl)).status, 429);

      for (let i = 0; i < 5; i++) {
        assert.equal((await fetch(`${baseUrl}/info`)).status, 200);
        assert.equal((await fetch(`${baseUrl}/`)).status, 200);
      }
    });
  });

  test('jede App-Instanz hat einen eigenen Zähler', async () => {
    const options = { rateLimit: { limit: 1 } };
    await withServer(createApp(options), async (baseUrl) => {
      assert.equal((await postEcho(baseUrl)).status, 200);
      assert.equal((await postEcho(baseUrl)).status, 429);
    });
    await withServer(createApp(options), async (baseUrl) => {
      assert.equal((await postEcho(baseUrl)).status, 200);
    });
  });
});
