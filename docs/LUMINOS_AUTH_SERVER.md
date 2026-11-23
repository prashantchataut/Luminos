# Luminos Auth: let offline-style players join your server properly

`luminos-auth` is a small Yggdrasil-compatible login service. Run it yourself (or use a community one), point your Minecraft **server** at it with [authlib-injector](https://github.com/yushijinhun/authlib-injector), and players with a Luminos account can join even without a purchased Minecraft account.

## Honest limits
- **Servers must opt in.** A server you don't run, running `online-mode=true` against Mojang, will refuse a Luminos account. Luminos tells you so and does not try to get around it.
- Luminos accounts are *our* identities. They are not Mojang accounts and cannot be used on Hypixel and similar networks.
- Profile UUIDs are `OfflinePlayer:<name>` UUIDs. A player's inventory and world data are the same whether your server later runs offline-mode or luminos-auth.

## Run the service
```bash
cargo build --release -p luminos-auth
LUMINOS_AUTH_ADDR=0.0.0.0:8787 \
LUMINOS_AUTH_PUBLIC_URL=https://auth.example.org \
LUMINOS_AUTH_SKIN_DOMAINS=cdn.example.org \
LUMINOS_AUTH_DATA=/var/lib/luminos-auth \
./target/release/luminos-auth
```
Put it behind HTTPS (Caddy/nginx). First start creates `signing-key.pem` (RSA-2048). **Back it up**: changing it invalidates every signed profile.
Create an account: `POST /luminos/register {"login","password","playerName"}`. Set `LUMINOS_AUTH_REGISTRATION=closed` to stop public sign-ups.

## Point your Minecraft server at it
Keep `online-mode=true`. Start the server with the injector:
```bash
java -javaagent:authlib-injector-1.2.8.jar=https://auth.example.org -jar paper.jar nogui
```
`tools/luminos-auth-server-template/` has a ready `docker-compose.yml` and `start.sh` that download the pinned injector jar and verify its SHA-256 (`9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10`).

## Player side
In Luminos: account menu → **Sign in with an Ely.by or Luminos account** → Luminos → your service URL, login, password. The launcher starts the game with the same injector and URL.

## What is tested
`cargo test -p luminos-auth` (9 conformance tests) and `cargo test -p luminos-core --test yggdrasil_e2e` (launcher client against the live server over TCP). Not yet tested: a real server process with the injector. Do that on your own server first.

## Not implemented
Email verification, password reset, per-IP rate limits, SQL storage, textures upload (the `PUT /luminos/profile/textures` endpoint accepts URLs from your `skinDomains` only; the upload service is `docs/COSMETICS_SERVICE.md`).
