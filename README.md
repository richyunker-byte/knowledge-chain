# Knowledge Chain

A browser-based, real-time story game for 2–4 players. Players join with a five-character room code, choose a subject, and add to the same story while learning age-appropriate elementary concepts.

## What is included

- Live room state over Socket.io: player presence, story, turn and review phases, server-based deadlines, scores, and chat.
- Built-in prompt bank and story openings for Science, Math, Language Arts, and Social Studies. No AI account, API key, database, login, or install for players is needed.
- Avatar selection, host controls, a 75-second turn timer, two rounds, peer cheers and flags, scoring, and a shared results/restart screen.
- Responsive touch-friendly layout and visible rules for new players.

## Run locally

Requires Node.js 20 or newer. In the project folder:

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in two browser windows or on two devices on the same network. For another device on your Wi-Fi, use your computer's local network address (for example `http://192.168.1.20:3000`). The server binds to `0.0.0.0` and reads the `PORT` environment variable.

## Deploy the game server to Render

1. Push this project to a GitHub repository.
2. In Render, create a **Blueprint** from the repository. `render.yaml` configures the Node service, `npm install`, `npm start`, and `/health` health checks. Or create a Web Service with those same build and start commands.
3. Wait for the service to finish deploying. Copy its public HTTPS address, such as `https://knowledge-chain-example.onrender.com`.
4. Keep the service URL for the Vercel setup below. Players use the Vercel link; the Socket.io connection goes to this service.

Render free web services spin down after 15 minutes without inbound HTTP traffic or WebSocket messages and can take about a minute to wake on a new visit. Rooms are held in memory, so a spin-down/restart clears the active games. Use an always-on service if uninterrupted play is important.

## Deploy the browser app to Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project's **Root Directory** to the repository root and configure it as a static/Other project. `vercel.json` runs the small configuration build and publishes `public/`.
3. Add this environment variable in Vercel project settings:
   - `KNOWLEDGE_CHAIN_SERVER` = your server URL, e.g. `https://knowledge-chain-example.onrender.com` (no trailing slash)
4. Deploy or redeploy. Share the Vercel URL with players.

The build writes the server address into `public/server-config.js`; the server address is public by design. If you change it, redeploy the Vercel app. The Node server already allows cross-origin Socket.io connections; for a restricted deployment, set `CLIENT_ORIGIN` on the server to the exact Vercel origin (for example `https://knowledge-chain.vercel.app`).

## Railway alternative

Create a Railway project from the repository, use a Node service with `npm install` and `npm start`, and expose an HTTP domain. Railway sets `PORT` automatically. Set `CLIENT_ORIGIN` to the Vercel origin if desired, then set Vercel's `KNOWLEDGE_CHAIN_SERVER` to the Railway domain and redeploy the frontend. Railway's available trial/free credits and plans can change; check the current dashboard before choosing a plan.

## Notes

Room codes and game state are held in the Node process memory. They remain shared among connected players while the service runs, but rooms are cleared when the server restarts or sleeps and wakes. Use a Redis adapter and a shared store if you later need multiple server instances or room recovery across restarts. The game intentionally has no account system and does not save personal information.

