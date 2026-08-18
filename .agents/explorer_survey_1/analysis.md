# Codebase Architecture Analysis — Slash Slice Arena

## Executive Summary
This document presents the detailed architectural investigation of the Slash Slice Arena repository (`blissful-hawking`). The project is a Web3-enabled action game built with React 19, Vite, Three.js, and Stellar/Soroban smart contracts, featuring a Vercel Serverless TypeScript backend backed by Vercel KV (Redis).

---

## 1. Module Boundaries, Package Manager & Build Configuration

### Package Manager & Workspace Setup
- **Package Manager**: `pnpm` (verified via `pnpm-lock.yaml` and `pnpm-workspace.yaml`).
- **Workspace Structure**: Single root package workspace configured in `pnpm-workspace.yaml` with build permissions for `@google/genai`, `bufferutil`, `esbuild`, `protobufjs`, and `utf-8-validate`.

### Module Boundaries
- `api/`: Serverless backend endpoints executed in Vercel Node.js serverless functions.
- `src/`: Client-side single-page application built with React 19, Tailwind CSS v4, Three.js / React Three Fiber, and Web3 wallet connectors.
  - `src/components/`: UI components including `StellarHub.tsx`, Leaderboard modals, HUD, and Canvas overlays.
  - `src/services/`: Services for Stellar wallet connections (`stellarWallet.ts`), Soroban contract configuration (`contractConfig.ts`), and WebSocket connectivity (`websocket.ts`).
  - `src/hooks/`: React hooks (e.g. `useSorobanNFTBalance.ts`).
- `contracts/` & `soroban-contracts/`: Soroban smart contract source code written in Rust (token minting and NFT collectibles).
- `docs/`: Comprehensive project specifications, including `API_REFERENCE.md`, `ARCHITECTURE.md`, `STELLAR_PRIVY_INTEGRATION.md`, and `WEB3_SOROBAN_STELLAR.md`.

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```
*Note on Linting vs Building*:
- `pnpm build` (`npx tsx copy-mediapipe-assets.js && vite build`) executes cleanly and completes in ~23 seconds without errors.
- `pnpm lint` (`tsc --noEmit`) currently fails due to un-excluded legacy root file `App_old.tsx` containing broken JSX tags. Adding `"exclude": ["App_old.tsx"]` or adding `"include": ["src/**/*", "api/**/*"]` to `tsconfig.json` fixes `pnpm lint`.

---

## 2. Existing API Routes (`api/`)

The repository hosts four existing API route handlers directly under `/api/`:

| Path | Primary HTTP Methods | Description | Handler Signature Pattern |
| :--- | :--- | :--- | :--- |
| `api/score.ts` | `GET`, `POST`, `OPTIONS` | Retrieves global top 20 rankings (`GET`) or submits new high score records (`POST`) to Vercel KV `slashslice:leaderboard_v2` with optional Stellar Fee-Bump transaction execution. | Node/Express: `(req: any, res: any)` |
| `api/wallet.ts` | `GET`, `OPTIONS` | Fetches user inventory data from Vercel KV `slashslice:wallet:<wallet>`. | Node/Express: `(req: any, res: any)` |
| `api/mint.ts` | `POST`, `OPTIONS` | Mints score tokens on Soroban Testnet using admin secret key. Implements KV sliding window rate limiting (`mint:rl:<address>`). | Web Standard: `(req: Request)` |
| `api/mint_nft.ts` | `POST`, `OPTIONS` | Mints cosmetic NFT badges on Soroban Testnet for milestone scores (>500). Implements KV rate limiting (`mintnft:rl:<address>`). | Web Standard: `(req: Request)` |

### API Design Patterns & CORS
- All handlers manually attach CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) and handle preflight `OPTIONS` requests.
- Score data is currently stored in Vercel KV using sorted set `slashslice:leaderboard_v2` and hash/key `slashslice:scores:<pubkey|name>`.

---

## 3. Database & Redis / Vercel KV Setup

- **Database Client**: `@vercel/kv` (version `^3.0.0`).
- **Connection Model**: API endpoints import `{ kv }` from `@vercel/kv` and use `const client = kv as any;`.
- **Environment Variables**:
  - `KV_REST_API_URL` and `KV_REST_API_TOKEN` are automatically injected by Vercel KV in deployment/staging environments.
  - `.env.production.local` and `.env.development.local` contain Vercel environment flags (`VERCEL=1`, `VERCEL_ENV=production`).
- **Mock Setup**: There is currently no standalone local Redis server or mock KV client package in `node_modules` or `scripts/`. In `api/mint.ts` and `api/mint_nft.ts`, KV operations are wrapped in try/catch blocks that "fail open" if KV connection details are not present.

---

## 4. Key Dependencies Analysis

### Core Dependencies (`package.json`)
- **Backend / Storage**: `@vercel/kv` (`^3.0.0`), `express` (`^4.21.2`), `dotenv` (`^17.2.3`).
- **Blockchain & Auth**: `@stellar/stellar-sdk` (`^15.1.0`), `@stellar/freighter-api` (`^6.0.1`), `@creit.tech/stellar-wallets-kit` (`1.9.5`), `@privy-io/react-auth` (`^3.29.2`), `@web3auth/*` (`^9.7.0`).
- **Frontend / Rendering**: `react` (`^19.0.1`), `react-dom` (`^19.0.1`), `three` (`^0.184.0`), `@react-three/fiber` (`^9.6.1`), `@react-three/drei` (`^10.7.7`), `@tailwindcss/vite` (`^4.1.14`), `lucide-react` (`^0.546.0`), `motion` (`^12.23.24`).
- **Dev Tools & Tooling**: `typescript` (`~5.8.2`), `vite` (`^6.2.3`), `tsx` (`^4.21.0`), `esbuild` (`^0.25.0`), `@types/express` (`^4.17.21`), `@types/node` (`^22.14.0`).

---

## 5. Scope & Requirements Alignment (`ORIGINAL_REQUEST.md`)

Subsequent development tasks will need to implement:
1. **`POST /api/user` & `GET /api/user`**: User registration with Stellar public key (`G...`), unique username (3-15 chars, alphanumeric + `_`), avatar, and Privy DID. Enforces username uniqueness using a Redis index key (e.g. `slashslice:user:by_username:<username>`). `GET` retrieves user profile, high scores, and global rank.
2. **`GET /api/leaderboard` & `GET /api/leaderboard/rank`**: Filtered leaderboard by mode (`arcade` | `classic`), timeframe (`alltime` | `weekly` | `daily`), with pagination (`limit`, `page`), rank, and percentile calculations.
3. **Score Sync & UI Integration**: Update `api/score.ts` to sync with new multi-period Redis keys (`slashslice:leaderboard:<mode>:alltime`, `weekly`, `daily`) and `slashslice:user:<pubkey>`. Update `StellarHub.tsx` to trigger user registration upon login.
4. **Documentation**: Update `docs/API_REFERENCE.md` with OpenAPI specifications for `/api/user` and `/api/leaderboard`.
