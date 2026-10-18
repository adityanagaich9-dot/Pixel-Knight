# Pixel Knight Gaming Portal

This folder is the static website that GitHub Pages serves. It includes the original browser-build game at `games/pixel-knight/` and a separate room-code arena at `online-duel/`.

## Publish the website

Upload the contents of this `MyGamingPortal` folder into the matching `MyGamingPortal/` folder in the `Pixel-Knight` GitHub repository. Keep the directory structure unchanged. Wait for GitHub Pages to finish deploying, then open:

`https://adityanagaich9-dot.github.io/Pixel-Knight/MyGamingPortal/`

## Enable cross-city browser duels for free

GitHub Pages can serve the page but cannot run the WebSocket game server. The server source and `package.json` are in `multiplayer-server/`. In Render, create a Blueprint from the repository root `render.yaml`, or create a Web Service manually with:

- Root Directory: `MyGamingPortal/multiplayer-server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Plan: `Free`

After deployment, copy the service's public HTTPS URL into the **Multiplayer server URL** field on Online Duel on both players' devices. Player 1 creates a room and shares the four-character code; Player 2 enters it and joins. The browser page converts the HTTPS address to secure WebSockets automatically.

Render's free web services sleep after 15 minutes without inbound traffic and may take about a minute to start again. Free hosting is intended for testing/hobby use, so this server is suitable for trying private matches, not a guaranteed always-on public game service.

## What's online

The browser single-player game includes the updated mode selector. Online Duel is a separate one-versus-one arena and does not make the full campaign cooperative.
