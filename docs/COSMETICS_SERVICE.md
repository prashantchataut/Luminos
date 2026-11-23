# luminos-cosmetics: design and hosting cost (not built)

Nothing in this file is implemented yet. It exists so the build can start from a decided design.

## Scope
Upload and serve skins and capes, with moderation, for Luminos accounts and Luminos Client users.

## API (planned)
- `PUT /v1/skin` (bearer: Luminos/Yggdrasil access token): PNG 64×64 or 64×32 only, ≤ 24 KB, magic-bytes and dimension check, re-encoded server-side to strip metadata. Model auto-detect (classic/slim) from the arm pixels.
- `PUT /v1/cape`: 64×32 (or 22×17 legacy) static; animated capes = vertical strip + `.mcmeta`-style JSON, **Luminos Client only**.
- `GET /t/<sha256>.png`: immutable, CDN-cached; URL is content-addressed. "Signed" = the Yggdrasil profile property is RSA-signed by `luminos-auth`; the texture URL itself is public.
- `POST /v1/report`, `GET /admin/queue`, `POST /admin/takedown/<hash>`.

## Storage and limits
S3-compatible object store (Cloudflare R2) for PNGs; SQLite (Litestream backup) or Postgres for metadata. Hash-dedupe on SHA-256 of the re-encoded image. Limits: 5 uploads per hour per account, 1 MB request cap, 50 MB total per account.

## Cost (estimates from public price lists, check before committing)
| Part | Free tier | Beyond |
|---|---|---|
| Cloudflare R2 | 10 GB storage, 1M writes, 10M reads / month, free egress | ≈ US$0.015 / GB-month |
| Fly.io (1 shared-cpu 256 MB VM, 1 GB volume) | roughly US$2–4 / month; the old free allowance no longer applies to new accounts | scale per VM |
| Domain | ≈ US$10 / year | |
A skin is ≈ 3 KB: 100 000 users ≈ 300 MB. Storage is not the cost; moderation time is.

## Where a skin is visible (what the UI must say)
| Situation | Who sees it | How |
|---|---|---|
| Both players run Luminos Client | each other | client mod fetches textures from this service |
| Server uses luminos-auth / authlib-injector | everyone on that server | standard signed profile property via `luminos-auth` |
| Offline server, no client mod | only you (locally) | needs a SkinsRestorer-style server plugin; not shipped yet |
| Premium account on any server | everyone | applied through Mojang's own API; Mojang owns that |

## Open-library rule
Do not call third-party skin libraries until their ToS is read and recorded here with attribution. Currently used (session 1): Minotar / MC-Heads for username lookups only.
