const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, validateEchoBody } = require('../index');

let server;
let baseUrl;

before(async () => {
  // Hohes Limit, damit die Validierungstests nicht ins Rate-Limit laufen
  server = createApp({ rateLimit: { limit: 1000 } }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function postJson(body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${baseUrl}/api/echo`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('validateEchoBody', () => {
  test('akzeptiert gültige Nachricht und trimmt sie', () => {
    assert.deepEqual(validateEchoBody({ message: '  Hallo  ' }), {
      valid: true,
      value: { message: 'Hallo' },
    });
  });

  for (const [name, body] of [
    ['null', null],
    ['Array', ['a']],
    ['String', 'text'],
    ['fehlendes message', {}],
    ['message als Zahl', { message: 42 }],
    ['leerer String', { message: '   ' }],
    ['zu lang', { message: 'x'.repeat(1001) }],
    ['unbekanntes Feld', { message: 'ok', extra: true }],
  ]) {
    test(`lehnt ab: ${name}`, () => {
      const result = validateEchoBody(body);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });
  }

  test('akzeptiert genau 1000 Zeichen', () => {
    assert.equal(validateEchoBody({ message: 'x'.repeat(1000) }).valid, true);
  });
});

describe('POST /api/echo', () => {
  test('gültige Nachricht → 200 mit Echo und Zeitstempel', async () => {
    const res = await postJson({ message: 'Hallo' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.echo, { message: 'Hallo' });
    assert.ok(!Number.isNaN(Date.parse(body.receivedAt)));
  });

  for (const [name, payload] of [
    ['fehlendes message', { msg: 'Hallo' }],
    ['falscher Typ', { message: 1 }],
    ['leerer String', { message: '' }],
    ['zu lang', { message: 'x'.repeat(1001) }],
    ['unbekanntes Feld', { message: 'Hallo', admin: true }],
    ['Array als Body', [{ message: 'Hallo' }]],
  ]) {
    test(`${name} → 400 mit details`, async () => {
      const res = await postJson(payload);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'Ungültige Eingabe');
      assert.ok(Array.isArray(body.details) && body.details.length > 0);
    });
  }

  test('kaputtes JSON → 400 als JSON (nicht HTML)', async () => {
    const res = await postJson('{kaputt');
    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { error: 'Ungültiges JSON' });
  });

  test('Body > 10kb → 413', async () => {
    const res = await postJson({ message: 'x'.repeat(11 * 1024) });
    assert.equal(res.status, 413);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  test('falscher Content-Type → 415', async () => {
    const res = await postJson('message=Hallo', { 'Content-Type': 'text/plain' });
    assert.equal(res.status, 415);
  });

  test('GET auf /api/echo → 404', async () => {
    const res = await fetch(`${baseUrl}/api/echo`);
    assert.equal(res.status, 404);
  });
});
