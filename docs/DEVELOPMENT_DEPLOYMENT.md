# 🛠️ Development, Configuration & Deployment Manual

## 📋 Executive Summary

This document provides a step-by-step guide for running **Slash Slice Arena** locally, setting up network testing on mobile devices, configuring environment variables, and deploying to Vercel production.

---

## 💻 Local Setup & Prerequisites

### Requirements
- **Node.js**: `v18.x` or `v20.x`
- **Package Manager**: `pnpm` (v9+ or v10+)
- **Webcam**: Required for Camera Control Mode.

### Quickstart Commands

```bash
# 1. Clone the repository
git clone https://github.com/CaBsCrypto/pizzaninja.git
cd pizzaninja

# 2. Install dependencies
pnpm install

# 3. Launch local dev server (default port: 3000)
pnpm dev
```

The dev server will start at:
- **Local PC**: `https://localhost:3000`
- **Local Network (Tablets/Phones)**: `https://192.168.1.x:3000`

---

## 🔒 HTTP vs. HTTPS & Secure Context Requirements

Privy's embedded wallet SDK requires a **Secure Context** (`window.isSecureContext === true`) to initialize WebCrypto (`window.crypto.subtle`) APIs.

### Environment Context Behavior

| Protocol / Host | Secure Context? | WebCrypto Available? | Privy Behavior |
| :--- | :--- | :--- | :--- |
| `https://localhost:3000` | ✅ Yes | Native | Full Privy Social Login active |
| `http://localhost:3000` | ✅ Yes (Localhost exception)| Native | Full Privy Social Login active |
| `http://192.168.1.x:3000` | ❌ No | Polyfilled in `main.tsx` | Game playable; Privy social login requires HTTPS |
| `https://slashslice.spicycrust.com` | ✅ Yes | Native | Full Production Web3 Active |

> [!TIP]
> To test on mobile devices over local Wi-Fi without SSL warnings, `src/main.tsx` includes an automatic WebCrypto polyfill so non-secure HTTP testing will never crash the game.

---

## 🔑 Environment Variables Reference Table

Copy `.env.example` to `.env` or set these in your Vercel Dashboard:

| Variable Name | Type | Description | Required? |
| :--- | :--- | :--- | :--- |
| `VITE_PRIVY_APP_ID` | Client | Privy Application ID (from dashboard.privy.io) | Yes |
| `ADMIN_PUBLIC_KEY` | Server | Stellar G-address for server-side fee-bumping | Yes (For Soroban) |
| `ADMIN_SECRET_KEY` | Server | Stellar S-secret key for signing fee-bump wrappers | Yes (For Soroban) |
| `KV_REST_API_URL` | Server | Vercel KV (Redis) REST Endpoint URL | Optional (Redis Leaderboard) |
| `KV_REST_API_TOKEN` | Server | Vercel KV REST Access Bearer Token | Optional (Redis Leaderboard) |
| `VITE_PARTYKIT_HOST` | Client | Custom PartyKit WebSocket host (default: `127.0.0.1:1999`) | Optional |

---

## 🚀 Vercel Deployment & Build Pipeline

### Pre-Build Script (`copy-mediapipe-assets.js`)

Before Vite builds the production bundle, `copy-mediapipe-assets.js` runs automatically to copy MediaPipe TFLite models (`hand_landmark_full.tflite`) and WebAssembly binary assets (`hands_solution_simd_wasm_bin.wasm`) into the public distribution folder, patching SIMD detection guards for Safari/iOS compatibility.

### Production Deploy Command

```bash
# Verify local compilation build
pnpm build

# Deploy directly to Vercel Production
vercel --prod --yes
```

### Serverless Function Routes (`/api`)

Vercel automatically compiles and deploys API routes in `/api`:
- `/api/score`: Receives signed score XDRs, executes fee-bumps, and updates Vercel KV.
- `/api/mint` & `/api/mint_nft`: Handles Soroban NFT token minting transactions.
