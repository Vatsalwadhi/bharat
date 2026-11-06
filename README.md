# Bharat City — open-world game with no-sign-in multiplayer

One small Node.js server that:
- serves the game (everything in `public/`)
- relays multiplayer between players who enter the same room code (WebSocket at `/ws`)

Nobody needs an account. Open the site → phone → Multiplayer → Create room → share the code.

## Run on your computer
```
npm install
npm start
```
Open http://localhost:8080. Other devices on the same Wi-Fi can open `http://<your-computer-ip>:8080`.

## Put it online for free (Render)
1. Create a new GitHub repository and upload everything in this folder
   (`server.js`, `package.json`, `render.yaml`, `public/` …). Don't upload `node_modules`.
2. Go to https://render.com → sign in with GitHub → **New → Blueprint** → pick the repository.
   (Or **New → Web Service**: Build command `npm install`, Start command `npm start`, Free plan.)
3. Wait for the deploy, then open the `https://bharat-city-xxxx.onrender.com` link and share it.

Free-plan note: the server sleeps after ~15 minutes with nobody playing; the first visit after that
takes about a minute to wake it up.

## Details
- Up to 16 players per room. Rooms disappear when everyone leaves.
- `/health` shows how many people are connected.
- Set the `PORT` environment variable to change the port (Render sets it for you).
