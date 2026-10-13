# WL Command Center — opsætning til Filip

**Fra:** Nicki / WeeLeaf  
**Til:** Filip (IT)  
**Hvad:** Privat administrativt arbejdsrum til Nicki og autoriserede admins.  
**Erstatter ikke** den eksisterende offentlige WeeLeaf-platform (Vite + PHP + MySQL).

---

## 1. Læs dette først

Command Center er et **nyt lag**, ikke en opdatering af den nuværende site.

| | Offentlig WeeLeaf | WL Command Center |
|---|---|---|
| Formål | Medlemmer, shop, landing | Intern administration |
| Adgang | Offentlig | Kun login. Privat. |
| Stack | Vite + React + PHP/MySQL | Node 22 + React 19 + TanStack Start + Postgres |
| Hosting | Nuværende (Hostinger m.m.) | Skal køre som **Node/SSR-app** (Vercel, Node-VPS, eller tilsvarende) |

Den kan **ikke** lægges op som PHP-filer på den eksisterende Hostinger-konto.  
Den kan køre på et **subdomæne** (fx `admin.weeleaf.dk`) med reverse proxy til Node, eller på Vercel.

---

## 2. Sådan kører du den lokalt

Krav: **Node.js 22**, npm.

```bash
unzip WL-Command-Center-til-Filip.zip
cd wl-command-center
npm install
npm run dev
```

Uden `DATABASE_URL` bruger appen en indbygget Postgres (PGLite) i hukommelsen.  
Data forsvinder ved genstart — fint til test, ikke til drift.

Første person der logger ind (e-mail/adgangskode, Google eller X) bliver **superadmin**.  
Øvrige konti venter, indtil en superadmin tildeler rolle under **Brugere**.

---

## 3. Produktion — miljøvariabler

Læg **aldrig** nøgler i Git, zip eller frontend. Kun i hostens hemmelige miljø.

### Påkrævet

| Variabel | Formål |
|---|---|
| `DATABASE_URL` | Postgres-forbindelse (Neon, eller anden Postgres 15+). Uden den kører appen på throwaway-PGLite. |
| `BETTER_AUTH_SECRET` | Lang tilfældig hemmelighed (mindst 32 tegn). Signerer sessionscookies. |
| `BETTER_AUTH_URL` | Offentlig kanonisk URL, fx `https://admin.weeleaf.dk` — uden afsluttende `/`. |
| `XAI_API_KEY` | xAI/Grok-nøgle til Leafy. **Kun server.** Aldrig `VITE_`-præfiks. Aldrig i browser. |

### Anbefalet

| Variabel | Formål |
|---|---|
| `XAI_MODEL` | Standard er `grok-4.5`. Kan sættes til nyere model uden kodeændring. |
| `VITE_AUTH_ENABLED` | Skal være `true` (eller udelades). `false` slår rigtig login fra. |

### Valgfrit (Google / X via Grok-broker)

Hvis I deployer uden Grok App Builder, virker **e-mail/adgangskode** (allerede slået til).  
Google/X kræver Grok-broker-klient (`GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`, `GROK_AUTH_ISSUER`). Uden dem: brug e-mail-login.

### Postgres

Migreringer ligger i `migrations/`:

- `0001_auth.sql` — Better Auth (brugere, sessioner)
- `0002_command_center.sql` — opgaver, forslag, økonomi, medlemmer, log m.m.

`npm run build` kører `db:migrate` mod `DATABASE_URL`.

---

## 4. Build og deploy

Appen er bygget til **Vercel** (Nitro-preset). Det er den korteste vej.

```bash
npm ci
npm run build
```

Output: `.vercel/output/` (SSR + static).

### Vercel (anbefalet)

1. Nyt projekt, Root = denne mappe, Node 22.
2. Sæt miljøvariablerne ovenfor.
3. Provisionér Postgres (Neon er det appen er skrevet til).
4. Deploy. Første login = superadmin.

### Node-VPS / Hostinger med Node

1. Node 22, `npm ci && npm run build`.
2. Kør SSR-serveren fra Vercel/Nitro-output (ikke bare `vite preview`).
3. HTTPS foran (nginx/Caddy). Cookies er `__Host-` og kræver **Secure** over HTTPS.
4. Sæt `BETTER_AUTH_URL` til det præcise offentlige origin.

Del **ikke** database med den eksisterende MySQL-shop. Command Center har sit eget skema i Postgres.

---

## 5. Hvad appen gør (produkt)

- Privat admin på `/admin`. Landing + login på `/` og `/login`.
- Roller (håndhæves på serveren): superadmin, økonomi, projekt, teknisk, læser.
- **Leafy** (Grok via backend) forbereder. Mennesker godkender. Godkendelse er **ikke** udførsel.
- Efter godkendelse kører backend handlingen og logger resultatet. Idempotent.
- Ændres beløb, modtager eller handling → ny godkendelse.
- Genveje til SKAT, Virk, bank, shop m.m. er **links**, ikke integrationer.
- Økonomi adskilt: forening / enkeltmandsvirksomhed / planlagt ApS.
- 10–20–30: 30 % rabat = 20 % medlemsbesparelse + 10 % WL-provision.
- Medlemmer/ordrer/økonomi i v1 er **testdata**, tydeligt mærket. Den eksisterende shop er **ikke** live-koblet.

---

## 6. Sikkerhed (ikke til forhandling)

- `XAI_API_KEY` kun på serveren. Aldrig i frontend, GitHub eller chat.
- Grok har ikke direkte databaseadgang. Function calling går gennem vores lag.
- Person-, løn- og bankdetaljer sendes ikke til Grok.
- Ingen bogføring, SKAT-indberetning eller bankoverførsel i Command Center.
- Understøttede handlinger efter godkendelse: intern log, opret opgave, gem rapport, gem mailkladde (sendes ikke), «integration mangler».

---

## 7. Første tjek efter opsætning

1. Åbn den offentlige URL → login, ikke admin-indhold.
2. Opret Nickis konto → hun bliver superadmin.
3. Dashboard viser dagsopgaver og briefing (testdata er mærket).
4. Godkend en intern testhandling → status **Gennemført** og loglinje.
5. Afvis en handling → den udføres **ikke**.
6. Skriv til Leafy → svar kommer fra Grok, påstand om udførsel er forbudt.
7. Tjek i browserens netværk at `XAI_API_KEY` **ikke** findes i JS-bundles.

---

## 8. Senere (ikke i denne zip)

- Live medlemmer/ordrer fra den eksisterende MySQL-shop
- Rigtig mail-udsendelse og bogføringsintegration bag samme godkendelsesflow
- DNS: peg `admin.weeleaf.dk` (eller I’s valg) på denne app. Rør ikke den offentlige site.

Spørgsmål: Nicki. Denne zip indeholder kildekode, ikke nøgler.
