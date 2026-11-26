# REDLINE

REDLINE is a multi-tenant desk for a small business. The owner signs up, sets how the agent should speak, and pastes a chat widget on their site. Visitors can ask questions, leave a name and phone, and book an open slot. The owner sees the lead, the conversation, and the appointment.

The interface is Romanian by default. English is in `src/i18n/en.ts` and can be switched with RO / EN.

## Run

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Demo accounts after seeding:

| Business | Email | Password |
| --- | --- | --- |
| Salon Iris | iris@salon-iris.ro | DemoIris2026! |
| Service Auto Radu | radu@service-radu.ro | DemoRadu2026! |
| Clinica Dentară Exemplu (Premium) | clinica@dentară-exemplu.ro | DemoClinica2026! |

The salon test page is [http://127.0.0.1:43123/preview/pk_demo_saloniris](http://127.0.0.1:43123/preview/pk_demo_saloniris).
The dental clinic preview is [http://127.0.0.1:43123/preview/pk_demo_clinicadentara](http://127.0.0.1:43123/preview/pk_demo_clinicadentara).

## LLM key

Copy `.env.example` to `.env`.

```
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

If `OPENAI_API_KEY` is empty, the widget uses a clearly labelled demo responder. It still reads the business settings, offers real free slots, and can book them. With a key, the same tools go to the model named in `OPENAI_MODEL`.

`SESSION_SECRET` signs the session cookie. Use a long random value outside this machine.

## Publish (Vercel)

Use the **Publish** control in Cursor, or connect the repo in the Vercel dashboard.

Before the live site can sign people in and store bookings:

1. Create a **Postgres** database (Vercel Storage → Postgres, or Neon / Supabase).
2. In `prisma/schema.prisma`, set `provider = "postgresql"` (local stays on SQLite until you do this).
3. In the Vercel project env vars, set at least:
   - `DATABASE_URL` — the Postgres connection string
   - `SESSION_SECRET` — a long random string
   - optional: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
4. After the first deploy, run migrations against that database (`npx prisma db push` with the production `DATABASE_URL`, then seed if you want the demo salons).

SQLite (`file:./dev.db`) is for local runs only. Vercel’s filesystem is not a durable database.

Session cookies use `Secure` automatically when `VERCEL=1` (HTTPS). Local `npm run start` over plain HTTP keeps them non-Secure so login still works on `127.0.0.1`.

## Embed the widget

In the dashboard, open Widget and copy the snippet. It looks like this:

```html
<script src="http://127.0.0.1:43123/widget.js" data-key="pk_demo_saloniris" async></script>
```

`data-lang="en"` switches the widget chrome to English. The default is Romanian.

When the agent is paused, the chat says the business will reply later and stores the message.

## Tests

```bash
npm test
```

The suite checks that one business cannot read or change another's rows, and that two bookings cannot take the same time.

## What comes later

The data model already has a place for it, and phase 1 does not turn it on:

- WhatsApp, phone, and TikTok use the same `handleInbound` path, with a channel on the visitor and the conversation.
- A marketing agent can store a `ContentProposal`. Nothing here publishes a post or spends money. A person would have to approve that first.

---

# REDLINE

REDLINE este recepția unei afaceri mici. Proprietarul își face cont, spune agentului cum să vorbească și pune un chat pe site. Vizitatorul întreabă, lasă numele și telefonul și poate rezerva un interval liber. Proprietarul vede clientul, conversația și programarea.

Interfața este în română. Engleza este în `src/i18n/en.ts` și se schimbă din RO / EN.

## Pornire

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Deschideți [http://127.0.0.1:43123](http://127.0.0.1:43123).

Conturi demo, după seed:

| Afacere | Email | Parolă |
| --- | --- | --- |
| Salon Iris | iris@salon-iris.ro | DemoIris2026! |
| Service Auto Radu | radu@service-radu.ro | DemoRadu2026! |
| Clinica Dentară Exemplu (Premium) | clinica@dentară-exemplu.ro | DemoClinica2026! |

Pagina de test a salonului: [http://127.0.0.1:43123/preview/pk_demo_saloniris](http://127.0.0.1:43123/preview/pk_demo_saloniris).
Previzualizare clinică: [http://127.0.0.1:43123/preview/pk_demo_clinicadentara](http://127.0.0.1:43123/preview/pk_demo_clinicadentara).

## Cheia de model

Copiați `.env.example` în `.env`.

```
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Dacă `OPENAI_API_KEY` este goală, chatul folosește un răspuns demonstrativ, marcat ca atare. Citește setările afacerii, oferă intervale reale și poate face programarea. Cu o cheie, aceleași unelte merg la modelul din `OPENAI_MODEL`.

`SESSION_SECRET` semnează sesiunea. În afara acestei mașini, puneți un șir lung și aleator.

## Publicare (Vercel)

Folosiți **Publish** în Cursor sau conectați repo-ul în Vercel.

Înainte ca site-ul live să țină sesiuni și programări:

1. Creați o bază **Postgres** (Vercel Storage → Postgres, sau Neon / Supabase).
2. În `prisma/schema.prisma`, setați `provider = "postgresql"` (local rămâne pe SQLite până atunci).
3. În variabilele de mediu Vercel puneți cel puțin:
   - `DATABASE_URL` — connection string Postgres
   - `SESSION_SECRET` — șir lung aleator
   - opțional: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
4. După primul deploy, rulați migrările pe acea bază (`npx prisma db push` cu `DATABASE_URL` de producție, apoi seed dacă vreți saloanele demo).

SQLite (`file:./dev.db`) e doar pentru local. Pe Vercel filesystem-ul nu e bază de date.

Cookie-urile de sesiune sunt `Secure` automat când `VERCEL=1` (HTTPS). Local, pe HTTP, rămân fără Secure ca să meargă loginul pe `127.0.0.1`.

## Widgetul

În panou, la Widget, copiați scriptul:

```html
<script src="http://127.0.0.1:43123/widget.js" data-key="pk_demo_saloniris" async></script>
```

`data-lang="en"` trece cadrul chatului în engleză. Implicit este româna.

Când agentul este oprit, chatul spune că afacerea răspunde mai târziu și păstrează mesajul.

## Teste

```bash
npm test
```

Testele arată că o afacere nu poate citi sau modifica datele alteia și că două programări nu pot ocupa aceeași oră.

## Ce urmează

Modelul de date are deja locul, iar faza asta nu le pornește:

- WhatsApp, telefonul și TikTok intră pe același `handleInbound`, cu un canal pe vizitator și pe conversație.
- Un agent de marketing poate salva un `ContentProposal`. Nimic de aici nu publică și nu cheltuie. Ar trebui ca un om să aprobe înainte.
