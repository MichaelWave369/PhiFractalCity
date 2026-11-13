# ΦFractalCity R0.5: Local Intelligence Bridge

**Status: experimental security prototype.** Automated tests do not prove Quest 3 browser connectivity, valid headset TLS trust, Local Network Access permission, or actual local Ollama inference.

## Architecture

The visitor explicitly chooses Paired HTTPS LAN bridge in the Talk to Ori panel, enters a URL and pairing token, and clicks Ask. No automatic connection occurs. The optional server runs on the operator's Windows PC under Node.js 22+, listening ONLY on a specified RFC1918 private IPv4 or loopback address with TLS. It forwards validated chat requests exclusively to Ollama at **http://127.0.0.1:11434/api/chat**.

The **only exposed application route** is POST /v1/chat, plus its CORS OPTIONS preflight. Other model APIs, repositories, file systems, private vaults, tool invocation and code execution are not exposed.

The server checks an exact allowed browser origin (default **https://michaelwave369.github.io**), a random 256-bit bearer pairing token generated at each start, strict request schema, question and context size limits, single-request concurrency, rate limits, and upstream timeouts. The browser accepts only private IPv4, localhost or .local URLs over HTTPS at port 8765 and path /v1/chat. No user-configured arbitrary internet proxy is permitted. The pairing token is kept only in the current browser page input, never localStorage, GitHub, or exported city JSON.

**No remote port forwarding, public tunnel, wildcard CORS, HTTP bearer token, TLS bypass or LAN exposure of the Ollama port.**

## Run on Windows PC (PowerShell)

1. Have Node.js 22+, a running Ollama service, and a locally installed chat model ready.
2. Determine your PC's actual private LAN IPv4 (e.g. with ipconfig). Quest and PC must have a working LAN path.
3. Prepare a TLS certificate/private key with a Subject Alternative Name matching that LAN IP or .local hostname. The Quest browser **must trust the issuing CA**. A locally issued mkcert or self-signed certificate trusted by Windows is not automatically trusted by Quest. Do not bypass certificate errors. This is often the hardest part of getting this prototype working on a standalone headset.
4. From the repository root, replace the following **example** address/paths with your own:

~~~powershell
$env:PHI_BRIDGE_BIND="192.168.1.50"
$env:PHI_BRIDGE_TLS_CERT="C:\path\to\cert.pem"
$env:PHI_BRIDGE_TLS_KEY="C:\path\to\key.pem"
$env:PHI_BRIDGE_ALLOWED_ORIGIN="https://michaelwave369.github.io"
npm run bridge
~~~

5. The PC terminal prints a fresh 64-character hex pairing token. Keep the terminal open. Permit inbound TCP 8765 in the PC firewall **only from the specific Quest local IP**. Never forward this port to the internet.
6. On Quest, visit **https://michaelwave369.github.io/PhiFractalCity/**, switch the inference transport to Paired HTTPS LAN bridge, enter the bridge URL matching your certificate SAN (example: **https://192.168.1.50:8765/v1/chat**) and enter the pairing token. Choose a locally installed model ID and press Ask.
7. If the browser requests **local network access permission**, approve only if you recognize and trust the PC bridge. A permission grant is NOT the same as a trusted TLS certificate or a matching token.
8. Use Forget pairing token, reload the page, or close the tab to clear the browser secret. Ctrl+C in the PC terminal stops the server.

For localhost-only desktop testing, set PHI_BRIDGE_BIND=127.0.0.1 and use a valid trusted certificate for 127.0.0.1. If accessing via your Vite developer origin instead of GitHub Pages, set PHI_BRIDGE_ALLOWED_ORIGIN to that **exact** origin (for example, http://127.0.0.1:5173). Production use should only permit the intended HTTPS site origin.

## Browser behavior and limitations

Chromium's Local Network Access rules may require a specific local-network or loopback-network browser permission. Public GitHub Pages is HTTPS, but Chrome/Quest implementations can vary. **The physical Quest 3 path has not been tested.** Its 2D browser UI can accept typed pairing values; there is **no in-headset VR keyboard or voice transcription in this rung**. The XR workshop console remains separate.

- Chrome guidance: https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access
- MDN: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access
- Ollama chat API: https://github.com/ollama/ollama/blob/main/docs/api.md

## Data policy

Only an explicit question, current pocket address, and up to four bounded **public world notes** and four **approved concepts** from that pocket can reach Ollama. Ori's private vault, other pockets, pending proposals, browser storage, files, and repository contents are deliberately omitted. Model text is **unverified**, not saved automatically, and a human must stage and approve it before an inspectable concept marker can be published.

The source model is tagged in workshop provenance. The bridge has no model-issued tools or background autonomous agent process. Browser/page-origin access to this token and local computer access are security boundaries; it is not a multi-user identity system.

## Verification

- Run **npm run check** to execute tests for the authenticated bridge, CORS origin enforcement, fixed upstream, validation, rate limiting, private-context exclusion, browser endpoint restrictions, and Vite build.
- On the operator PC, verify the HTTPS certificate, pairing token, unavailable-Ollama error, and one real model response.
- On Quest 3, test certificate trust, local-network permission, Wi-Fi reachability, wrong-token behavior, page-reload secret clearing, and real in-headset model/scene experience.
- Do not claim verified Quest-to-PC intelligence until that physical test succeeds.

**Nothing is required of you here.**
