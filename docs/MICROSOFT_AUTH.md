# Microsoft sign-in

**Status: UNVERIFIED end to end.** The code path is complete and compiles in CI; it has never been run against a real Microsoft account because that needs an Azure app registration only the project owner can create.

## What is built (`launcher/crates/luminos-core/src/msauth.rs`, `app/src-tauri/src/lib.rs`)
Device-code flow, no embedded webview, no client secret.
1. `ms_device_begin` asks `login.microsoftonline.com/consumers/oauth2/v2.0/devicecode` for a code; the UI shows it with `microsoft.com/link`.
2. `ms_device_finish` polls the token endpoint until approval, then runs Xbox Live, XSTS, `login_with_xbox` and the profile call. A 404 from the profile call becomes "This Microsoft account does not own Minecraft: Java Edition."
3. **New in 0.9.1:** the session is kept in the account store, so `mojang_set_skin` can apply a skin to the signed-in account.

## What you must do once
1. portal.azure.com > Microsoft Entra ID > App registrations > New registration. Name: Luminos. Supported account types: **Personal Microsoft accounts only** (or "any directory and personal").
2. Authentication > Advanced settings > **Allow public client flows: Yes**. Add no redirect URI and create no secret.
3. API permissions: nothing to add; the scope `XboxLive.signin offline_access` is requested at sign-in.
4. Copy the **Application (client) ID**. Set `LUMINOS_MS_CLIENT_ID` in the environment, or bake it into the release build.
5. Minecraft services reject unknown Azure apps until approved: submit the app at aka.ms/AppRegInfo. Until then sign-in returns an "invalid app registration" error. This is Microsoft policy, not a Luminos bug.
6. Test with a real account that owns Java Edition: add account > code > approve > check that the name appears and that "Apply to Mojang account" succeeds.

Without a client id the UI says so and offers an offline profile. There is no button that pretends to work.

## Tests
`cargo test -p luminos-core` covers the parsers with mocked data (`mojang.rs`: base64, textures property, multipart body; `msauth.rs`: Xbox error text, device-code defaults). **Not built:** a mock HTTP server for the token exchange; the endpoints are constants in `msauth.rs`, so a mock needs an override hook first.
