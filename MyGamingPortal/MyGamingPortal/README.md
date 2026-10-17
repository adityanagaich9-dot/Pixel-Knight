# 🕹️ My Gaming Portal

This is your ready-to-deploy gaming website where anyone can play your games in their browser!

## 📁 Directory Structure
```
d:\MyGamingPortal\
  ├── index.html                  <-- Your Main Portal Website
  └── games\
       ├── pixel-knight\          <-- Pixel Knight (playable in browser!)
       │    ├── index.html
       │    ├── pixel.knight.apk
       │    ├── pixel.knight.tar.gz
       │    └── favicon.png
       └── [future-game-2]\       <-- Easily add future games here!
```

---

## 🚀 How to Host It Online for FREE (So Everyone Can Play)

You can publish this entire website on the internet in under 3 minutes for completely free with either **GitHub Pages**, **Vercel**, or **Netlify**:

### Option 1: Netlify Drop (Easiest — 60 Seconds, No Code!)
1. Go to **[https://app.netlify.com/drop](https://app.netlify.com/drop)** in your web browser.
2. Drag and drop the **`d:\MyGamingPortal`** folder straight onto the page.
3. You immediately get a public link like `https://arcade-hub-xyz.netlify.app` that you can share with your friends, family, and players anywhere in the world!

---

### Option 2: GitHub Pages (Free forever + custom domain)
1. Create a free repository on [GitHub](https://github.com).
2. Upload the contents of `d:\MyGamingPortal`.
3. Go to **Settings** &rarr; **Pages** &rarr; select `main` branch &rarr; **Save**.
4. Your website is live at `https://<your-username>.github.io/<repo-name>/`.

---

## ➕ How to Add New Games in the Future

Whenever you create a new game:
1. Export your game to HTML5/WebAssembly.
2. Put the game folder into `games/<new-game-name>/`.
3. Open `index.html` and duplicate one of the `<article class="game-card">` sections with your new game's name, description, and link!
