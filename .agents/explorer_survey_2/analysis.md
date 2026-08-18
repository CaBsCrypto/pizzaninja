# Survey Explorer 2: User Profile, Stellar/Privy Authentication & Score Sync Analysis Report

## Executive Summary
This report analyzes the codebase requirements for implementing User Registration & Profile Management (`POST /api/user` and `GET /api/user`), Stellar Public Key (`G...`) and Privy DID identity integration, and UI / API synchronization (`StellarHub.tsx` and `api/score.ts`) for Slash Slice Arena.

Currently, user identification relies on informal client-provided display strings (`name` in `api/score.ts`) or raw public keys (`pubkey`). To transition to a full production-ready Web3 user system backed by Vercel KV (Redis), we must establish formal identity endpoints, deterministic key derivation, Redis uniqueness indexes, and seamless UI profile management.

---

## 1. User Registration & Profile Management (`/api/user`)

### Existing Code State
- **`/api/user.ts`**: Does NOT exist in the repository. Currently, `api/` contains only `mint.ts`, `mint_nft.ts`, `score.ts`, and `wallet.ts`.
- **Existing User Storage**: `api/wallet.ts` reads `slashslice:wallet:<wallet>` for inventory/ingredients, while `api/score.ts` tracks scores via `slashslice:scores:<identityKey>` and `slashslice:leaderboard_v2`.

### Requirements & Design Specifications (`POST /api/user` and `GET /api/user`)

#### Data Model: User Profile (`slashslice:user:<pubkey>`)
```json
{
  "pubkey": "GAYX4B7K...92L",
  "username": "Ninja_Master",
  "avatar": "ninja_red",
  "privyDid": "did:privy:clp2u2k2c000kmt08y8r7u03q",
  "createdAt": 1770682800000,
  "updatedAt": 1770682800000,
  "highScores": {
    "arcade": 420,
    "classic": 310
  }
}
```

#### Redis Key Schema Strategy in Vercel KV
1. **User Profile Key**: `slashslice:user:<pubkey>` (JSON string or Hash object)
   - Primary storage for user profile metadata and personal high scores.
2. **Username Uniqueness Index**: `slashslice:username:<lowercase_username>` -> value: `<pubkey>`
   - Used for atomic username uniqueness verification. Before registering/updating a username, check if `slashslice:username:<normalized>` exists.
   - If registered to a different `pubkey`, reject with `409 Conflict` or `400 Bad Request`.
3. **Privy DID Index**: `slashslice:privy:<privyDid>` -> value: `<pubkey>`
   - Enables fast profile lookup via Privy DID (`did:privy:...`).

---

### Endpoint Specifications

#### `POST /api/user` — Register or Update Profile
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "pubkey": "GAYX4B7K...92L",
    "username": "Ninja_Master",
    "avatar": "ninja_red",
    "privyDid": "did:privy:clp2u2k2c000kmt08y8r7u03q"
  }
  ```
- **Validation Rules**:
  1. **Stellar Public Key Validation**:
     - Format: Standard Base32 Ed25519 Stellar key, 56 characters starting with `G`.
     - Regex: `/^G[A-Z2-7]{55}$/` (or Stellar SDK `StrKey.isValidEd25519PublicKey(pubkey)`).
  2. **Username Rules**:
     - Length: 3 to 15 characters inclusive.
     - Allowed Characters: Alphanumeric characters (`a-z`, `A-Z`, `0-9`) and underscore (`_`).
     - Regex: `/^[a-zA-Z0-9_]{3,15}$/`.
     - Uniqueness: Server checks `slashslice:username:<lowercase_username>`. If key exists and points to another `pubkey`, reject with `{ "error": "Username already taken" }`.
  3. **Avatar**: Optional string identifier (preset string e.g. `ninja_red`, `chef_gold` or valid HTTPS image URL). Defaults to `default_ninja`.
  4. **Privy DID**: Optional string format `did:privy:...`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "pubkey": "GAYX4B7K...92L",
      "username": "Ninja_Master",
      "avatar": "ninja_red",
      "privyDid": "did:privy:clp2u2k2c000kmt08y8r7u03q",
      "createdAt": 1770682800000,
      "updatedAt": 1770682800000
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid Stellar public key, invalid username format (length/characters).
  - `409 Conflict`: Username already registered to another user.

#### `GET /api/user` — Fetch User Profile & Ranks
- **Method**: `GET`
- **Query Parameters**:
  - `pubkey` (string, e.g. `?pubkey=GAYX...`) OR `username` (string) OR `privyDid` (string).
- **Behavior**:
  - Resolves target `pubkey` via direct query or index lookup (`slashslice:username:<normalized>` or `slashslice:privy:<privyDid>`).
  - Reads `slashslice:user:<pubkey>`.
  - Calculates personal high scores and global rank across `arcade` and `classic` modes via Redis `zrevrank` on `slashslice:leaderboard:<mode>:alltime`.
- **Response `200 OK`**:
  ```json
  {
    "pubkey": "GAYX4B7K...92L",
    "username": "Ninja_Master",
    "avatar": "ninja_red",
    "privyDid": "did:privy:clp2u2k2c000kmt08y8r7u03q",
    "createdAt": 1770682800000,
    "highScores": {
      "arcade": 420,
      "classic": 310
    },
    "ranks": {
      "arcade": 1,
      "classic": 4
    }
  }
  ```
- **Error Response `404 Not Found`**: `{ "error": "User profile not found" }`.

---

## 2. Existing Stellar Wallet, Privy DID & Username Mechanics

### A. Stellar Public Key (`G...`) Validation & Handling
- **Format**: Stellar Ed25519 Public Keys start with `G` and are exactly 56 characters long (Base32 encoded).
- **Validation**: Found in `api/mint.ts:7`:
  ```typescript
  const STELLAR_PUBKEY_RE = /^G[A-Z2-7]{55}$/;
  ```
- **Key Derivation from Privy DID** (found in `src/components/StellarHub.tsx:46-54`):
  ```typescript
  const encoder = new TextEncoder();
  const data = encoder.encode(user.id + "_spicycrust_privy_shared_salt_2026");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const keypair = Keypair.fromRawEd25519Seed(Buffer.from(hashArray));
  const pubKey = keypair.publicKey(); // Guaranteed valid G... Stellar Ed25519 public key
  ```
- **Key Derivation Safety**:
  - Deterministic: Same Privy DID (`user.id`) + app salt always produces the exact same Stellar Keypair.
  - Client-side: Key derivation happens inside client browser memory; secret seed is saved into `stellarWallet.ts:web3AuthKeypair` for Soroban contract transaction signing (`buildAndSignSubmitScoreTx`).

### B. Wallet Connection Modes in Code
1. **Privy Web2 Login (`gmail` / `google`)**:
   - Authentication provider via `@privy-io/react-auth`.
   - Derives deterministic native `G...` Stellar keypair.
   - Sets cross-subdomain cookie `stellar_wallet=<pubKey>; domain=.spicycrust.com`.
2. **Stellar Wallets Kit (`freighter` / `albedo` / `xbull`)**:
   - `src/services/stellarWallet.ts` uses `@creit.tech/stellar-wallets-kit`.
   - Connects browser extensions directly to obtain native `G...` address.
3. **Passkeys / Smart Wallet Demo (`passkey`)**:
   - Simulated WebAuthn credential flow deriving mock `G...` address (length 49 hex hash).
   - *Note*: API validation (`/^G[A-Z2-7]{55}$/`) will reject demo passkeys if stricter checks are enabled; score submission logic (`api/score.ts:81`) currently checks for mock prefixes (`MOCK`, `PASS`).

---

## 3. UI Integration & API Synchronization Requirements

### A. `StellarHub.tsx` Profile Integration
- **Current Behavior**:
  - `StellarHub.tsx` handles wallet connection (Privy login, Freighter modal, Passkey demo).
  - Displays connected address (`walletState.publicKey`) and Soroban NFT status (`useSorobanNFTBalance`).
- **Required Integration**:
  1. **Profile Fetch on Connect**:
     - When `walletState.publicKey` becomes set, execute `GET /api/user?pubkey=${pubKey}`.
     - If response is `404`, trigger an inline Registration Modal asking the user to choose a username (3-15 chars, alphanumeric + `_`) and avatar.
  2. **Profile Creation**:
     - Call `POST /api/user` with `pubkey`, `username`, `avatar`, and `privyDid` (`user?.id`).
     - Save returned profile in local React state / context so the UI renders `username` instead of truncated `G...` address.
  3. **Profile Display & Editing**:
     - Render active username, avatar icon, global rank, and total $SLICE balance.
     - Provide an "Edit Profile" button to update username or avatar.

### B. Score Submission & Sync (`api/score.ts`)
- **Current Behavior**:
  - `api/score.ts` writes to `slashslice:scores:<identityKey>` and `slashslice:leaderboard_v2`.
- **Required Integration**:
  1. **Sync Scores to Multi-Period Keys**:
     - Write to `slashslice:leaderboard:<mode>:alltime` (zset) with member `<pubkey>` (or JSON record) and score as value.
     - Also write to `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>` and `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>`.
  2. **Update User Profile Personal Best**:
     - Read user profile from `slashslice:user:<pubkey>`.
     - Compare `score` against `highScores[mode]`.
     - If higher, update `highScores[mode]` inside `slashslice:user:<pubkey>`.
  3. **Username Resolution**:
     - If `pubkey` is provided in `POST /api/score`, fetch registered username from `slashslice:user:<pubkey>`.
     - Store the registered username in the leaderboard record rather than arbitrary unverified string input.

### C. Game Loop (`App.tsx` & `Leaderboard.tsx`)
- **`App.tsx`**:
  - Update `handleGameOver` and `scoreRegistrationCard` (lines 468-601).
  - When user is logged in with Stellar/Privy, automatically attach `pubkey`, `privyDid`, and registered `username` to score payload.
- **`Leaderboard.tsx`**:
  - Display registered usernames and avatars alongside verified Stellar signatures (`txHash`).

---

## 4. Architectural Summary Table

| Feature | Key / Path | Validation / Rule |
| :--- | :--- | :--- |
| **User Profile Key** | `slashslice:user:<pubkey>` | Hash/JSON storing pubkey, username, avatar, privyDid, highScores |
| **Username Uniqueness Index** | `slashslice:username:<lowercase_username>` | Points to `<pubkey>`. Case-insensitive uniqueness |
| **Privy DID Index** | `slashslice:privy:<privyDid>` | Points to `<pubkey>` |
| **Leaderboard All-Time ZSet** | `slashslice:leaderboard:<mode>:alltime` | Redis Sorted Set ordered by score descending |
| **Stellar Key Regex** | `/^G[A-Z2-7]{55}$/` | Standard Ed25519 public key (56 chars) |
| **Username Regex** | `/^[a-zA-Z0-9_]{3,15}$/` | 3 to 15 chars, alphanumeric + underscore |
