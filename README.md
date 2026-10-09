# TubePulse PRO - Next.js 15/16+ & React 19+ Cloudflare Industrial YouTube Downloader

An industrial-grade, high-performance YouTube video & audio extractor built with **Next.js 15/16+ (App Router)**, **React 19+**, **TypeScript**, **Tailwind CSS**, **Cloudflare Workers**, and **In-Browser WebAssembly FFmpeg**.

Designed specifically to operate at high scale with **$0 VPS server costs** and **$0 residential proxy costs**.

---

## 🏗️ Architecture & Strategy Overview

Most YouTube downloaders hit severe roadblocks:
1. **Datacenter IP Bans:** YouTube blocks server IPs (AWS, GCP, Hetzner, Cloudflare) with `429 Too Many Requests` or `403 Bot Detection` errors when fetching stream bytes.
2. **High Bandwidth & Compute Costs:** Re-encoding or downloading 1080p/4K video streams on a VPS burns massive CPU and bandwidth ($50–$200/mo).

### 💡 The Industrial Solution:

```
[User Browser] --(1. Video Link)--> [Cloudflare Worker API / Next.js Serverless]
                                         |
                                   (InnerTube Android/iOS Context)
                                         |
[User Browser] <--(2. Stream URLs)-------'
     |
     +--(3. Direct Fetch Stream Chunks using User IP)--> [YouTube CDN *.googlevideo.com]
     |
     +--(4. In-Browser FFmpeg.wasm Merging)-------------> [Local 1080p/4K MP4 Saved!]
```

1. **Client-Direct Fetching:** Video byte chunks are fetched directly by the user's browser from YouTube's CDN (`*.googlevideo.com`). Because requests originate from the user's home/cellular IP, **YouTube never blocks them**.
2. **InnerTube API Rotation:** Cloudflare Worker API uses YouTube's internal `ANDROID`, `IOS`, and `TVHTML5` client contexts to bypass SABR bot-detection and extract un-encrypted direct stream URLs.
3. **In-Browser FFmpeg.wasm:** High Definition (1080p, 60fps, 4K) videos have separate audio and video streams (DASH format). FFmpeg WebAssembly runs inside a Web Worker thread in the user's browser, merging the streams in seconds with zero server load.

---

## 🚀 Tech Stack

- **Framework:** Next.js 15+ / Next.js 16 (App Router)
- **UI & Library:** React 19+
- **Styling:** TypeScript, Tailwind CSS, Lucide Icons, Glassmorphism design system
- **Edge Backend:** Cloudflare Worker (`wrangler.toml` + `src/worker.js`)
- **Media Engine:** `@ffmpeg/ffmpeg` WebAssembly (SharedArrayBuffer copy-muxing)

---

## 🛠️ How to Run Locally

### Prerequisites
Install [Node.js](https://nodejs.org/) (v20.x or v22.x recommended) on your machine.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Cloudflare Deployment Guide

### Deploying the Cloudflare Worker API
```bash
npx wrangler login
npm run deploy:worker
```

### Deploying Next.js to Cloudflare Pages / Vercel
- **Cloudflare Pages:** Connect your GitHub repo, select **Next.js (App Router)** preset.
- **Vercel:** Run `npx vercel` for 1-click global deployment.

---

## 📄 License
MIT License - Free for commercial and personal usage.
