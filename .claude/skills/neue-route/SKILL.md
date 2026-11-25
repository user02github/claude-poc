---
name: neue-route
description: Legt in diesem Express-Projekt eine neue Route nach den Projektregeln an (try/catch, explizite Statuscodes, 500-JSON), schreibt Tests dafür und trägt sie in CLAUDE.md ein. Verwenden, wenn der User eine neue Route/einen neuen Endpoint möchte.
argument-hint: <METHODE> <PFAD> – <was die Route tun soll>
---

# Neue Route anlegen

Auftrag des Users: **$ARGUMENTS**

## 1. Auftrag verstehen

- Lies aus dem Auftrag: HTTP-Methode (GET, POST, PUT, DELETE …), Pfad (z. B. `/time`, `/api/notes`) und was die Route liefern soll.
- Fehlt eines davon oder ist es unklar, frag kurz nach, bevor du Code schreibst.
- Prüfe in `index.js`, dass es die Route (Methode + Pfad) noch nicht gibt. Falls doch: abbrechen und dem User sagen.

## 2. Route in index.js einbauen

- Innerhalb von `createApp()`, **nach** den bestehenden Routen und **vor** dem JSON-Fehler-Handler (`app.use((err, req, res, next) => …)`).
- Pflicht laut CLAUDE.md – genau dieses Muster:

```js
app.get('/pfad', (req, res) => {
  try {
    // ... Logik ...
    res.status(200).json({ /* Ergebnis */ });
  } catch (err) {
    console.error('Fehler in GET /pfad:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});
```

- Statuscodes immer explizit setzen: `200`/`201` bei Erfolg, passender `4xx` bei Client-Fehlern.
- Routen mit Body (POST/PUT/PATCH):
  - Kein JSON → `415` mit `{ error: 'Content-Type muss application/json sein' }` (wie `POST /api/echo`).
  - Eingaben in einer eigenen Funktion `validate…Body(body)` prüfen (Vorbild: `validateEchoBody`), bei Fehlern `400` mit `{ error: 'Ungültige Eingabe', details: [...] }`.
  - Die Validierungsfunktion zusätzlich als `module.exports.<name>` exportieren.
- Pfade unter `/api/*` sind automatisch rate-limitiert – nichts extra einbauen.
- Fehlertexte und Kommentare auf Deutsch.

## 3. Tests schreiben

- GET-Routen ohne `/api`: in `test/app.test.js` einen neuen `describe('<METHODE> <PFAD>', …)`-Block nach dem Muster der bestehenden Tests (shared `app`, `baseUrl`, globales `fetch`).
- Routen unter `/api/*`: eigene Datei `test/<name>.test.js` und **`createApp({ rateLimit: { limit: 1000 } })`** statt der Default-Instanz verwenden (sonst greift das Limit von 10).
- Mindestens testen:
  1. Erfolgsfall: Statuscode, Content-Type, Inhalt der Antwort.
  2. Jeder Client-Fehler (`400`, `415` …), falls die Route Eingaben hat.
  3. `500`-Fall: eine verwendete Funktion mit `t.mock.method(...)` werfen lassen, `console.error` stummschalten, `{ error: 'Interner Serverfehler' }` prüfen.
- Testnamen auf Deutsch.

## 4. Prüfen

- `npm test` ausführen; alle Tests müssen grün sein. (Der PostToolUse-Hook führt die Tests nach jeder `.js`-Änderung ohnehin aus und meldet Fehler – diese sofort beheben.)

## 5. Dokumentieren

- In `CLAUDE.md` im Abschnitt `## Routes` eine Zeile für die neue Route ergänzen (gleicher Stil wie die vorhandenen Einträge).

## 6. Abschluss

- **Nicht committen** – das entscheidet der User.
- Kurze Zusammenfassung auf Deutsch: neue Route, geänderte Dateien, Anzahl Tests (grün/rot), und wie man sie ausprobiert, z. B.:
  `PORT=3001 npm start` und dann `curl -i localhost:3001<PFAD>` (nicht den Server des Users auf Port 3000 beenden).
