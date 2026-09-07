# shared

Logic that **must** behave identically on the client and the server.

Not a convenience folder — a correctness one. The build spec's acceptance test
is that the server's score equals the prototype's exactly. Two copies of the
scoring rule would drift the first time either was edited, and the test would
quietly stop proving anything. There is one copy, and both sides import it.

| File | Why it is shared |
|---|---|
| `scoring.js` | The client shows progress; the server computes the stored score. §4 says never trust the client's number — but both must agree on what the rule *is*. |
| `aiDetect.js` | The dashboard renders a verdict; the server produces the stored one. Same reason. |

Plain ES modules with no imports and no browser or Node APIs, so Vite bundles
them for the browser and Node loads them directly — no build step, no
duplication.

**Nothing environment-specific belongs here.** No `fetch`, no `fs`, no
`process.env`, no DOM. If it needs any of those it belongs in `client/` or
`server/`.
