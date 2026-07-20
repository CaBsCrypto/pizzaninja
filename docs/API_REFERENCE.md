# 🌐 OpenAPI 3.0 REST API Reference Specification

## 📋 Executive Summary

This document provides the official **OpenAPI 3.0 REST API Reference** for Slash Slice Arena's Vercel Serverless backend. 

The API endpoints handle global leaderboard read/write operations, serverless Stellar Soroban gas-sponsorship (Fee-Bumping), and Soroban token minting.

---

## 🖥️ Base Server URLs

| Environment | Base URL | Protocol |
| :--- | :--- | :--- |
| **Production** | `https://slashslice.spicycrust.com` | HTTPS |
| **Vercel Deployment** | `https://blissful-hawking-5tte2q65g-cabscryptocontacto-6028s-projects.vercel.app` | HTTPS |
| **Local Development** | `https://localhost:3000` | HTTPS (Self-Signed SSL) |

---

## 🛡️ Security, CORS & Rate Limiting

### CORS Headers
Endpoints configure explicit Cross-Origin Resource Sharing (CORS) headers:
- `Vary: Origin`
- `Access-Control-Allow-Origin: *` (or `ALLOWED_ORIGIN` environment value)
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Requested-With`

### Rate Limiting Policy
Endpoints `/api/mint` and `/api/mint_nft` implement Redis-backed sliding window rate limiters via `@vercel/kv`:
- **Window Size**: 60 seconds
- **Max Requests**: 10 requests per Stellar public key (`G...`) per window.
- **Fail-Open Behavior**: If Vercel KV is unavailable, rate limiting degrades gracefully to allow legitimate gameplay minting.

---

## 📑 Endpoints Reference

### 1. Leaderboard & Score Submissions (`/api/score`)

#### `GET /api/score`
Fetches the top 20 global leaderboard records ordered by highest score.

- **Request Headers**: `Accept: application/json`
- **Response `200 OK`**:
  ```json
  [
    {
      "name": "Ninja_Master",
      "score": 420,
      "pubkey": "GAYX...K92L",
      "mode": "arcade",
      "signedXdr": "AAAAAgAAAAD..."
    },
    {
      "name": "Slice_Chef",
      "score": 380,
      "pubkey": "GB3M...V82P",
      "mode": "classic"
    }
  ]
  ```

- **cURL Example**:
  ```bash
  curl -X GET "https://slashslice.spicycrust.com/api/score" \
    -H "Accept: application/json"
  ```

---

#### `POST /api/score`
Submits a new game record, updates personal bests in Redis, and executes an on-chain Stellar Fee-Bump transaction if a signed XDR is attached.

- **Request Body (`application/json`)**:
  ```json
  {
    "name": "Ninja_Master",
    "score": 420,
    "pubkey": "GAYX...K92L",
    "mode": "arcade",
    "signedXdr": "AAAAAgAAAAD..."
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "updated": true,
    "txHash": "c4d3e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7"
  }
  ```

- **Response `400 Bad Request`**:
  ```json
  {
    "error": "Missing identity or score"
  }
  ```

- **cURL Example**:
  ```bash
  curl -X POST "https://slashslice.spicycrust.com/api/score" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Ninja_Master",
      "score": 420,
      "pubkey": "GAYX4B7...K92L",
      "mode": "arcade"
    }'
  ```

---

### 2. Soroban Token Minting (`/api/mint`)

#### `POST /api/mint`
Mints fungible score tokens on Soroban Testnet for a validated player address.

- **Request Body (`application/json`)**:
  ```json
  {
    "playerAddress": "GAYX4B7K...92L",
    "score": 250
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "txHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "ledgerSequence": 1284950
  }
  ```

- **Response `400 Bad Request`**:
  ```json
  {
    "success": false,
    "error": "Invalid Stellar public key"
  }
  ```

- **Response `429 Too Many Requests`**:
  ```json
  {
    "success": false,
    "error": "Rate limit exceeded. Try again in a minute."
  }
  ```

- **cURL Example**:
  ```bash
  curl -X POST "https://slashslice.spicycrust.com/api/mint" \
    -H "Content-Type: application/json" \
    -d '{
      "playerAddress": "GAYX4B7K...92L",
      "score": 250
    }'
  ```

---

### 3. Soroban NFT Cosmetic Minting (`/api/mint_nft`)

#### `POST /api/mint_nft`
Mints a non-fungible cosmetic badge (NFT) on Soroban Testnet when a player achieves a milestone score (> 500 points).

- **Request Body (`application/json`)**:
  ```json
  {
    "playerAddress": "GAYX4B7K...92L",
    "score": 550
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "txHash": "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    "tokenId": "550"
  }
  ```

- **cURL Example**:
  ```bash
  curl -X POST "https://slashslice.spicycrust.com/api/mint_nft" \
    -H "Content-Type: application/json" \
    -d '{
      "playerAddress": "GAYX4B7K...92L",
      "score": 550
    }'
  ```

---

## 📊 HTTP Status Codes Reference

| Status Code | Reason | Description |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded. Returns data payload or transaction hash. |
| **`204 No Content`** | CORS Preflight | Returned for `OPTIONS` preflight requests. |
| **`400 Bad Request`** | Validation Error | Missing parameters, invalid Stellar address format, or score exceeds max bound (500,000). |
| **`403 Forbidden`** | Unauthorized Origin | Request origin violates CORS policies or Privy domain restrictions. |
| **`405 Method Not Allowed`** | Invalid HTTP Method | Calling `PUT` or `DELETE` on POST-only endpoints. |
| **`429 Too Many Requests`** | Rate Limited | Address exceeded 10 mint requests per 60-second window. |
| **`500 Internal Error`** | Server / Chain Error | Redis connection failure, missing `ADMIN_SECRET_KEY`, or Soroban RPC timeout. |
