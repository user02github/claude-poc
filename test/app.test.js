const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const app = require('../index');

let server;
let baseUrl;

before(async () => {
  // Port 0 = freier Zufallsport, kollidiert nicht mit einem laufenden Server auf 3000
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('GET /', () => {
  test('antwortet mit 200 und dem Begrüßungstext', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(await res.text(), 'Hello from Claude Code in Ubuntu!');
  });
});

describe('GET /info', () => {
  test('antwortet mit 200 und JSON mit Node-Version und Plattform', async () => {
    const res = await fetch(`${baseUrl}/info`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);

    const body = await res.json();
    assert.deepEqual(body, {
      nodeVersion: process.version,
      platform: os.platform(),
      os: os.type(),
      release: os.release(),
      arch: os.arch(),
    });
  });

  test('antwortet mit 500 und Fehler-JSON, wenn ein Fehler auftritt', async (t) => {
    t.mock.method(os, 'platform', () => {
      throw new Error('simulierter Fehler');
    });
    // Erwartetes console.error im catch-Block nicht in die Testausgabe schreiben
    t.mock.method(console, 'error', () => {});

    const res = await fetch(`${baseUrl}/info`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'Interner Serverfehler' });
  });
});

describe('GET /health', () => {
  test('antwortet mit 200 und { status: "ok", uptime }', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);

    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['status', 'uptime']);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0, 'uptime darf nicht negativ sein');
  });

  test('uptime kommt aus process.uptime()', async (t) => {
    t.mock.method(process, 'uptime', () => 42.5);

    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', uptime: 42.5 });
  });

  test('antwortet mit 500 und Fehler-JSON, wenn ein Fehler auftritt', async (t) => {
    t.mock.method(process, 'uptime', () => {
      throw new Error('simulierter Fehler');
    });
    t.mock.method(console, 'error', () => {});

    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'Interner Serverfehler' });
  });
});

describe('Unbekannte Route', () => {
  test('antwortet mit 404', async () => {
    const res = await fetch(`${baseUrl}/gibt-es-nicht`);
    assert.equal(res.status, 404);
  });
});
