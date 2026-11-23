# Code signing `Luminos-Setup.exe`

**State today: the installer is built and published unsigned.** The CI step exists (`release.yml`, "Sign installer") and
turns itself on when the secrets below exist. Nothing in the code has to change. The step has never run with real
credentials (UNVERIFIED), because no certificate or signing account exists yet.

## The one-command switch
After the owner has an account (below), add five repository secrets, then tag a release:

```bash
gh secret set AZURE_TENANT_ID           --body "<directory (tenant) id>"
gh secret set AZURE_CLIENT_ID           --body "<app registration client id>"
gh secret set AZURE_CLIENT_SECRET       --body "<client secret value>"
gh secret set AZURE_SIGNING_ENDPOINT    --body "https://eus.codesigning.azure.net"   # region endpoint of your account
gh secret set AZURE_SIGNING_ACCOUNT     --body "<trusted signing account name>"
gh secret set AZURE_SIGNING_PROFILE     --body "<certificate profile name>"
```
`HAVE_AZURE_SIGNING` in the workflow flips to `true` when the first four exist. The checksum step runs **after**
signing, so `SHA256SUMS.txt` always matches the published file, and the log prints the Authenticode status.

## What the owner must buy or apply for
Pick one. Both cost real money and need the owner's identity, which cannot be done from CI or by an agent.

| Option | What to do | Cost (check current pricing) | Notes |
|---|---|---|---|
| **Azure Trusted Signing** (recommended; now branded "Artifact Signing") | Azure subscription, create a Trusted Signing account and a *Public Trust* certificate profile, pass identity validation, create an app registration with the *Trusted Signing Certificate Profile Signer* role | roughly the price of a coffee a month at the basic tier | Short-lived certificates, no hardware token. Identity validation eligibility is limited by country and by organisation vs individual; check the current rules before starting |
| **OV code-signing certificate** (DigiCert, Sectigo, SSL.com, ...) | Buy an OV certificate and complete vetting | roughly 200 to 400 USD per year | Since mid-2023 new certificates must keep the private key on hardware (token or cloud HSM), so a `.pfx` in a GitHub secret generally does **not** work. Use the vendor's cloud-signing service (e.g. SSL.com eSigner, DigiCert KeyLocker) and replace the Azure step with theirs |

## SmartScreen: be honest with users
Signing makes the publisher name show up and removes "Unknown publisher", but **SmartScreen reputation still has to be
earned**. Even a validly signed new binary can show "Windows protected your PC" until enough people have downloaded and
run it without trouble; that takes days to weeks and cannot be bought or forced. Until then the README tells users to
verify the SHA-256 in `SHA256SUMS.txt`, which CI publishes and attests (build provenance) for every release.

## Verifying a signed build by hand
```powershell
Get-AuthenticodeSignature .\Luminos-Setup.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
signtool verify /pa /v .\Luminos-Setup.exe
```
`Status : Valid` and a timestamp countersignature are what a good result looks like.
