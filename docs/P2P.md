# P2P hosting (NOT BUILT)

Design only. Nothing here runs. Modelled on XMCL's public description: WebRTC data channel (DTLS), STUN, host-star, the host's world shown as a LAN world; signalling on a free Cloudflare Worker with one Durable Object per room.
* Cost: Workers free tier is 100k requests/day; Durable Objects on the free plan need the SQLite-backed class. Signalling messages are small; media never touches the Worker.
* Abuse: XMCL gates hosting behind a free account because open signalling brokers get spammed. Luminos would need the same (rate limit per IP, room TTL, max 8 peers). No relay (TURN) is planned; strict-NAT users would fail to connect.
* Client work remaining: signalling client, `RTCPeerConnection` in the webview, a native TCP bridge from the data channel to the LAN port, `luminos://join?room=` handling, manual test script.
