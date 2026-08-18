# 🌐 Slash Slice Arena — OpenAPI 3.0 REST API Reference

## 📋 Executive Summary

This document provides the authoritative **OpenAPI 3.0 REST API Reference Specification** for **Slash Slice Arena**'s Vercel Serverless REST API backend.

The backend infrastructure leverages Vercel Serverless Functions powered by `@vercel/kv` (Redis) as high-performance sorted-set (ZSET) data stores for multi-period leaderboards, user profile registries, and real-time rank/percentile indexing. It also integrates directly with the **Stellar Soroban Testnet** for on-chain fee-bumping, fungible token minting (`$SLICE`), and non-fungible cosmetic badge (NFT) minting.

---

## 🖥️ Base Server URLs

| Environment | Base URL | Protocol | Auth / Network |
| :--- | :--- | :--- | :--- |
| **Production** | `https://slashslice.spicycrust.com` | HTTPS | Stellar Mainnet / Testnet |
| **Vercel Deployment** | `https://blissful-hawking-5tte2q65g-cabscryptocontacto-6028s-projects.vercel.app` | HTTPS | Vercel KV REST + Soroban RPC |
| **Local Development** | `http://localhost:3000` | HTTP / HTTPS | In-Memory / Local Redis |

---

## 🛡️ Security, CORS & Rate Limiting

### CORS Headers Configuration
All REST endpoints implement standard Cross-Origin Resource Sharing (CORS) header policies:
- `Access-Control-Allow-Origin`: `*` (or value of `ALLOWED_ORIGIN` environment variable in production)
- `Access-Control-Allow-Methods`: `GET, POST, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version`
- `Access-Control-Allow-Credentials`: `true` (for user and leaderboard endpoints)
- `Vary`: `Origin`

### Rate Limiting Policy
Redis-backed sliding window rate limiters are configured via `@vercel/kv`:
- **Token Minting (`/api/mint`)**: Max **10 requests** per 60-second window per Stellar public key (`G...`).
- **NFT Minting (`/api/mint_nft`)**: Max **5 requests** per 60-second window per Stellar public key (`G...`).
- **Fail-Open Policy**: If Vercel KV rate limiting service is temporarily unavailable, rate checks fail-open to preserve uninterrupted gameplay.

---

## 📜 OpenAPI 3.0 Yaml Specification

```yaml
openapi: 3.0.3
info:
  title: Slash Slice Arena REST API
  description: Official OpenAPI 3.0 backend reference for Slash Slice Arena. Covers user management, multi-period leaderboards, score submissions, and Soroban web3 integrations.
  version: 1.0.0
  contact:
    name: Slash Slice Arena Team
    url: https://slashslice.spicycrust.com
servers:
  - url: https://slashslice.spicycrust.com/api
    description: Production Server
  - url: http://localhost:3000/api
    description: Local Development Server

paths:
  /user:
    post:
      summary: Register or update user profile
      operationId: registerUser
      tags:
        - User Management
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserRegisterRequest'
      responses:
        '201':
          description: User profile created or updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserRegisterResponse'
        '400':
          description: Invalid Stellar public key format or username format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: Username already taken
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
    get:
      summary: Retrieve user profile and game stats
      operationId: getUserProfile
      tags:
        - User Management
      parameters:
        - name: pubkey
          in: query
          required: false
          schema:
            type: string
          description: Stellar Ed25519 public key (G...)
        - name: username
          in: query
          required: false
          schema:
            type: string
          description: Registered player username
      responses:
        '200':
          description: Profile retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserProfileResponse'
        '400':
          description: Missing query parameter or invalid format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /leaderboard:
    get:
      summary: Fetch paginated multi-period leaderboard
      operationId: getLeaderboard
      tags:
        - Leaderboard
      parameters:
        - name: mode
          in: query
          required: false
          schema:
            type: string
            enum: [arcade, classic]
            default: arcade
          description: Game mode filter
        - name: timeframe
          in: query
          required: false
          schema:
            type: string
            enum: [alltime, weekly, daily]
            default: alltime
          description: Leaderboard period filter
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
          description: Number of records per page (max 100)
        - name: page
          in: query
          required: false
          schema:
            type: integer
            default: 1
            minimum: 1
          description: Page number (1-indexed)
      responses:
        '200':
          description: Paginated leaderboard entries
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaderboardResponse'
        '400':
          description: Invalid query parameter value
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /leaderboard/rank:
    get:
      summary: Lookup exact player rank and percentile
      operationId: getPlayerRank
      tags:
        - Leaderboard
      parameters:
        - name: pubkey
          in: query
          required: false
          schema:
            type: string
          description: Stellar public key
        - name: username
          in: query
          required: false
          schema:
            type: string
          description: Registered player username
        - name: mode
          in: query
          required: false
          schema:
            type: string
            enum: [arcade, classic]
            default: arcade
        - name: timeframe
          in: query
          required: false
          schema:
            type: string
            enum: [alltime, weekly, daily]
            default: alltime
      responses:
        '200':
          description: Player rank and percentile details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RankLookupResponse'
        '400':
          description: Missing identity parameter or invalid mode/timeframe
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Player not found on specified leaderboard
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /score:
    post:
      summary: Submit score and update multi-period leaderboards
      operationId: submitScore
      tags:
        - Score Submissions
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScoreSubmissionRequest'
      responses:
        '200':
          description: Score accepted and synced
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScoreSubmissionResponse'
        '400':
          description: Missing identity or score value
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server error or Soroban fee-bump failure
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
    get:
      summary: Get top 20 global scores
      operationId: getGlobalScores
      tags:
        - Score Submissions
      responses:
        '200':
          description: List of top scores
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ScoreRecord'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /mint:
    post:
      summary: Mint Soroban $SLICE tokens
      operationId: mintTokens
      tags:
        - Soroban Tokenomics
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MintTokenRequest'
      responses:
        '200':
          description: Tokens minted on Testnet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MintTokenResponse'
        '400':
          description: Invalid player address or score
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /mint_nft:
    post:
      summary: Mint Soroban cosmetic badge NFT
      operationId: mintNFT
      tags:
        - Soroban Tokenomics
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MintNFTRequest'
      responses:
        '200':
          description: NFT badge minted on Testnet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MintNFTResponse'
        '400':
          description: Invalid player address
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '405':
          description: Method Not Allowed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    UserRegisterRequest:
      type: object
      required:
        - pubkey
        - username
      properties:
        pubkey:
          type: string
          pattern: '^G[A-Z2-7]{55}$'
          example: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'
        username:
          type: string
          pattern: '^[a-zA-Z0-9_]{3,15}$'
          example: 'Ninja_Chef'
        avatar:
          type: string
          example: 'ninja_avatar_1.png'
        privyDid:
          type: string
          example: 'did:privy:cm7x89q0z00003b6t12345678'

    UserRegisterResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        user:
          $ref: '#/components/schemas/UserProfile'

    UserProfile:
      type: object
      properties:
        pubkey:
          type: string
        username:
          type: string
        avatar:
          type: string
        privyDid:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    UserProfileResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        user:
          $ref: '#/components/schemas/UserProfile'
        stats:
          type: object
          properties:
            arcadeScore:
              type: number
            classicScore:
              type: number
            globalRank:
              type: number
              nullable: true
        pubkey:
          type: string
          example: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'
        username:
          type: string
          example: 'Ninja_Chef'
        avatar:
          type: string
          example: 'ninja_avatar_1.png'
        privyDid:
          type: string
          example: 'did:privy:cm7x89q0z00003b6t12345678'
        createdAt:
          type: string
          format: date-time
          example: '2026-08-11T00:00:00.000Z'
        updatedAt:
          type: string
          format: date-time
          example: '2026-08-11T00:00:00.000Z'
        scores:
          type: object
          properties:
            arcade:
              type: number
              example: 850
            classic:
              type: number
              example: 620
        rank:
          type: object
          properties:
            arcade:
              type: number
              nullable: true
              example: 1
            classic:
              type: number
              nullable: true
              example: 4

    LeaderboardResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        mode:
          type: string
          enum: [arcade, classic]
        timeframe:
          type: string
          enum: [alltime, weekly, daily]
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
        players:
          type: array
          items:
            $ref: '#/components/schemas/LeaderboardEntry'

    LeaderboardEntry:
      type: object
      properties:
        rank:
          type: integer
        pubkey:
          type: string
        username:
          type: string
        avatar:
          type: string
        score:
          type: number
        mode:
          type: string
        timeframe:
          type: string
        percentile:
          type: number
        topPercentage:
          type: number

    RankLookupResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        pubkey:
          type: string
        username:
          type: string
        avatar:
          type: string
        score:
          type: number
        mode:
          type: string
        timeframe:
          type: string
        rank:
          type: integer
        total:
          type: integer
        totalPlayers:
          type: integer
        percentile:
          type: number
        topPercentage:
          type: number
        topPercentile:
          type: number

    ScoreSubmissionRequest:
      type: object
      required:
        - score
      properties:
        score:
          type: number
          example: 1250
        pubkey:
          type: string
          example: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'
        name:
          type: string
          example: 'Ninja_Chef'
        mode:
          type: string
          enum: [arcade, classic]
          default: arcade
        signedXdr:
          type: string
          example: 'AAAAAgAAAAD...'

    ScoreSubmissionResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        updated:
          type: boolean
          example: true
        score:
          type: number
        mode:
          type: string
        rank:
          type: integer
          nullable: true
        txHash:
          type: string

    ScoreRecord:
      type: object
      properties:
        name:
          type: string
        score:
          type: number
        pubkey:
          type: string
        mode:
          type: string
        signedXdr:
          type: string

    MintTokenRequest:
      type: object
      required:
        - playerAddress
        - score
      properties:
        playerAddress:
          type: string
          pattern: '^G[A-Z2-7]{55}$'
          example: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'
        score:
          type: integer
          minimum: 1
          maximum: 500000

    MintTokenResponse:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
        txHash:
          type: string
        amount:
          type: number

    MintNFTRequest:
      type: object
      required:
        - playerAddress
      properties:
        playerAddress:
          type: string
          pattern: '^G[A-Z2-7]{55}$'
          example: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'

    MintNFTResponse:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
        txHash:
          type: string

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: 'Invalid parameter'
```

---

## 📑 Endpoints Reference Specification

### 1. User Registration (`POST /api/user`)

#### `POST /api/user`
Registers a new player profile or updates an existing player profile. Handles Stellar public key format validation, case-insensitive username uniqueness checking via Redis key `slashslice:username:<normalized_username>`, avatar storage, and optional Privy DID indexing.

- **HTTP Method**: `POST`
- **Path**: `/api/user`
- **Content-Type**: `application/json`

#### Request Parameters
| Parameter | In | Type | Required | Description | Validation Rules / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pubkey` | Body | `string` | **Yes** | Stellar Ed25519 public key | Must match `/^G[A-Z2-7]{55}$/`. |
| `username` | Body | `string` | **Yes** | Player display username | 3-15 chars, `/^[a-zA-Z0-9_]{3,15}$/`. Case-insensitive uniqueness check. |
| `avatar` | Body | `string` | No | Avatar identifier or image URL | Default fallback: `"default"`. |
| `privyDid` | Body | `string` | No | Privy DID identifier | Stores reverse lookup `slashslice:privy:<privyDid>`. |

#### Request Body Schema (`application/json`)
```json
{
  "type": "object",
  "required": ["pubkey", "username"],
  "properties": {
    "pubkey": { "type": "string", "example": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L" },
    "username": { "type": "string", "example": "Ninja_Chef" },
    "avatar": { "type": "string", "example": "ninja_avatar_1.png" },
    "privyDid": { "type": "string", "example": "did:privy:cm7x89q0z00003b6t12345678" }
  }
}
```

#### Response Status Codes
- **`201 Created`**: User profile created or updated successfully.
  ```json
  {
    "success": true,
    "user": {
      "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
      "username": "Ninja_Chef",
      "avatar": "ninja_avatar_1.png",
      "privyDid": "did:privy:cm7x89q0z00003b6t12345678",
      "createdAt": "2026-08-11T00:00:00.000Z",
      "updatedAt": "2026-08-11T00:00:00.000Z"
    }
  }
  ```
- **`400 Bad Request`**: Invalid Stellar public key format or illegal username characters.
  ```json
  {
    "success": false,
    "error": "Invalid username format. Must be 3-15 alphanumeric characters or underscores."
  }
  ```
- **`405 Method Not Allowed`**: Request method is not `POST`, `GET`, or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`409 Conflict`**: Username already registered by another public key.
  ```json
  {
    "success": false,
    "error": "Username already taken"
  }
  ```
- **`500 Internal Server Error`**: Redis storage connection error.

#### Code Examples

##### cURL
```bash
curl -X POST "https://slashslice.spicycrust.com/api/user" \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
    "username": "Ninja_Chef",
    "avatar": "ninja_avatar_1.png",
    "privyDid": "did:privy:cm7x89q0z00003b6t12345678"
  }'
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pubkey: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L',
    username: 'Ninja_Chef',
    avatar: 'ninja_avatar_1.png',
    privyDid: 'did:privy:cm7x89q0z00003b6t12345678'
  })
});
const data = await response.json();
console.log(data);
```

---

### 2. User Profile Retrieval (`GET /api/user`)

#### `GET /api/user`
Retrieves stored user profile metadata, high scores per mode (arcade & classic), and current global all-time rank. Accepts either `pubkey` or `username` as lookup parameter.

- **HTTP Method**: `GET`
- **Path**: `/api/user`

#### Request Parameters
| Parameter | In | Type | Required | Description | Validation Rules / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pubkey` | Query | `string` | **Optional\*** | Stellar public key | `/^G[A-Z2-7]{55}$/` |
| `username` | Query | `string` | **Optional\*** | Player username | `/^[a-zA-Z0-9_]{3,15}$/` |

*\*Must provide at least one of `pubkey` or `username`.*

#### Response Status Codes
- **`200 OK`**: User profile and statistics retrieved successfully.
  ```json
  {
    "success": true,
    "user": {
      "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
      "username": "Ninja_Chef",
      "avatar": "ninja_avatar_1.png",
      "privyDid": "did:privy:cm7x89q0z00003b6t12345678",
      "createdAt": "2026-08-11T00:00:00.000Z",
      "updatedAt": "2026-08-11T00:00:00.000Z"
    },
    "stats": {
      "arcadeScore": 850,
      "classicScore": 620,
      "globalRank": 1
    },
    "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
    "username": "Ninja_Chef",
    "avatar": "ninja_avatar_1.png",
    "privyDid": "did:privy:cm7x89q0z00003b6t12345678",
    "scores": {
      "arcade": 850,
      "classic": 620
    },
    "rank": {
      "arcade": 1,
      "classic": 4
    }
  }
  ```
- **`400 Bad Request`**: Missing both `pubkey` and `username`, or invalid format.
  ```json
  {
    "success": false,
    "error": "Missing pubkey or username parameter"
  }
  ```
- **`404 Not Found`**: User not found in Redis registry.
  ```json
  {
    "success": false,
    "error": "User not found"
  }
  ```
- **`405 Method Not Allowed`**: Request method is not `GET`, `POST`, or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`500 Internal Server Error`**: Redis engine query error.

#### Code Examples

##### cURL
```bash
curl -X GET "https://slashslice.spicycrust.com/api/user?username=Ninja_Chef" \
  -H "Accept: application/json"
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/user?pubkey=GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L');
const data = await response.json();
console.log(data.stats);
```

---

### 3. Paginated Leaderboard (`GET /api/leaderboard`)

#### `GET /api/leaderboard`
Fetches paginated leaderboard records sorted by highest score (descending) across game modes (`arcade`, `classic`) and timeframes (`alltime`, `weekly`, `daily`). Each entry includes rank, player metadata, score, percentile, and top percentage.

- **HTTP Method**: `GET`
- **Path**: `/api/leaderboard`

#### Request Parameters
| Parameter | In | Type | Required | Default | Allowed Values / Range | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mode` | Query | `string` | No | `"arcade"` | `arcade`, `classic` | Target game mode |
| `timeframe` | Query | `string` | No | `"alltime"` | `alltime`, `weekly`, `daily` | Leaderboard period |
| `limit` | Query | `integer` | No | `20` | `1` to `100` | Number of entries per page |
| `page` | Query | `integer` | No | `1` | `>= 1` | 1-indexed page number |

#### Response Status Codes
- **`200 OK`**: Paginated leaderboard page returned successfully.
  ```json
  {
    "success": true,
    "mode": "arcade",
    "timeframe": "alltime",
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "players": [
      {
        "rank": 1,
        "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
        "username": "Ninja_Chef",
        "avatar": "ninja_avatar_1.png",
        "score": 1250,
        "mode": "arcade",
        "timeframe": "alltime",
        "percentile": 100,
        "topPercentage": 2.38
      },
      {
        "rank": 2,
        "pubkey": "GB3M7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L2",
        "username": "Slice_Master",
        "avatar": "default",
        "score": 980,
        "mode": "arcade",
        "timeframe": "alltime",
        "percentile": 97.62,
        "topPercentage": 4.76
      }
    ],
    "entries": [ /* Alias of players */ ]
  }
  ```
- **`400 Bad Request`**: Invalid mode, timeframe, limit, or page parameter.
  ```json
  {
    "success": false,
    "error": "Invalid limit parameter. Must be an integer between 1 and 100."
  }
  ```
- **`405 Method Not Allowed`**: Request method is not `GET` or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`500 Internal Server Error`**: Redis query failure.

#### Code Examples

##### cURL
```bash
curl -X GET "https://slashslice.spicycrust.com/api/leaderboard?mode=arcade&timeframe=weekly&limit=10&page=1" \
  -H "Accept: application/json"
```

##### TypeScript / JavaScript Fetch
```typescript
const params = new URLSearchParams({ mode: 'classic', timeframe: 'alltime', limit: '20', page: '1' });
const response = await fetch(`https://slashslice.spicycrust.com/api/leaderboard?${params.toString()}`);
const data = await response.json();
console.log(data.players);
```

---

### 4. Player Rank Lookup (`GET /api/leaderboard/rank`)

#### `GET /api/leaderboard/rank`
Calculates exact numerical rank, total player count in leaderboard ZSET, percentile ranking, and top percentage metric for a given player by `pubkey` or `username`.

- **HTTP Method**: `GET`
- **Path**: `/api/leaderboard/rank`

#### Request Parameters
| Parameter | In | Type | Required | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pubkey` | Query | `string` | **Optional\*** | — | Stellar public key | `/^G[A-Z2-7]{55}$/` |
| `username` | Query | `string` | **Optional\*** | — | Registered player username | `/^[a-zA-Z0-9_]{3,15}$/` |
| `mode` | Query | `string` | No | `"arcade"` | Game mode filter | `arcade`, `classic` |
| `timeframe` | Query | `string` | No | `"alltime"` | Leaderboard period filter | `alltime`, `weekly`, `daily` |

*\*Must provide at least one of `pubkey` or `username`.*

#### Response Status Codes
- **`200 OK`**: Player rank and percentile metrics calculated successfully.
  ```json
  {
    "success": true,
    "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
    "username": "Ninja_Chef",
    "avatar": "ninja_avatar_1.png",
    "score": 1250,
    "mode": "arcade",
    "timeframe": "alltime",
    "rank": 1,
    "total": 50,
    "totalPlayers": 50,
    "percentile": 100,
    "topPercentage": 2,
    "topPercentile": 2
  }
  ```
- **`400 Bad Request`**: Missing identity parameter or invalid query option.
  ```json
  {
    "success": false,
    "error": "Missing pubkey or username parameter"
  }
  ```
- **`404 Not Found`**: Player not found on specified leaderboard sorted set or user not registered.
  ```json
  {
    "success": false,
    "error": "Player not found on specified leaderboard"
  }
  ```
- **`405 Method Not Allowed`**: Request method is not `GET` or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`500 Internal Server Error`**: Redis query error.

#### Code Examples

##### cURL
```bash
curl -X GET "https://slashslice.spicycrust.com/api/leaderboard/rank?username=Ninja_Chef&mode=arcade&timeframe=alltime" \
  -H "Accept: application/json"
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/leaderboard/rank?pubkey=GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L&mode=arcade');
const rankData = await response.json();
console.log(`Rank #${rankData.rank} out of ${rankData.total} (Top ${rankData.topPercentage}%)`);
```

---

### 5. Score Submission & Sync (`POST /api/score`)

#### `POST /api/score`
Submits game completion score, updates multi-period Redis ZSET leaderboards (`alltime`, `weekly:<YYYY-Www>`, `daily:<YYYY-MM-DD>`), updates personal best high scores in user profile hash (`slashslice:user:<pubkey>`), and executes an on-chain Stellar Fee-Bump transaction if a signed transaction XDR (`signedXdr`) is attached.

- **HTTP Method**: `POST` (or `GET` for top 20 legacy global query)
- **Path**: `/api/score`
- **Content-Type**: `application/json`

#### Request Parameters
| Parameter | In | Type | Required | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `score` | Body | `number` | **Yes** | — | Game score earned | Numeric, non-negative |
| `pubkey` | Body | `string` | **Optional\*** | — | Stellar Public Key | Valid Stellar address |
| `name` | Body | `string` | **Optional\*** | — | Display username / identity | String |
| `mode` | Body | `string` | No | `"arcade"` | Game mode | `arcade`, `classic` |
| `signedXdr` | Body | `string` | No | — | Signed Soroban transaction XDR | Base64 envelope XDR string |

*\*Must provide at least one of `pubkey` or `name`.*

#### Request Body Schema (`application/json`)
```json
{
  "type": "object",
  "required": ["score"],
  "properties": {
    "score": { "type": "number", "example": 1250 },
    "pubkey": { "type": "string", "example": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L" },
    "name": { "type": "string", "example": "Ninja_Chef" },
    "mode": { "type": "string", "enum": ["arcade", "classic"], "default": "arcade" },
    "signedXdr": { "type": "string", "example": "AAAAAgAAAAD..." }
  }
}
```

#### Response Status Codes
- **`200 OK`**: Score submitted and synced across Redis ZSETs.
  ```json
  {
    "success": true,
    "updated": true,
    "score": 1250,
    "mode": "arcade",
    "rank": 1,
    "txHash": "TxA9F8E7D6GAYXSig"
  }
  ```
- **`400 Bad Request`**: Missing score or player identity, or invalid numeric score.
  ```json
  {
    "success": false,
    "error": "Missing identity or score"
  }
  ```
- **`405 Method Not Allowed`**: Request method is not `GET` or `POST`.
- **`500 Internal Server Error`**: Redis write error or RPC transaction failure.

#### Code Examples

##### cURL
```bash
curl -X POST "https://slashslice.spicycrust.com/api/score" \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
    "name": "Ninja_Chef",
    "score": 1250,
    "mode": "arcade"
  }'
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pubkey: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L',
    score: 1250,
    mode: 'arcade',
    signedXdr: 'AAAAAgAAAAD...'
  })
});
const result = await response.json();
console.log(`Submitted score: updated=${result.updated}, rank=${result.rank}`);
```

---

### 6. Soroban Token Minting (`POST /api/mint`)

#### `POST /api/mint`
Mints fungible score tokens (`$SLICE`) on Soroban Testnet for a validated player address. (Conversion rate: 1 score point = 1 token with 7 decimals).

- **HTTP Method**: `POST`
- **Path**: `/api/mint`
- **Content-Type**: `application/json`

#### Request Parameters
| Parameter | In | Type | Required | Description | Validation / Bounds |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `playerAddress` | Body | `string` | **Yes** | Stellar Ed25519 public key | `/^G[A-Z2-7]{55}$/` |
| `score` | Body | `integer` | **Yes** | Earned game score | Min: 1, Max: 500,000 |

#### Response Status Codes
- **`200 OK`**: Soroban transaction confirmed on Testnet.
  ```json
  {
    "success": true,
    "message": "Transacción confirmada en la Testnet",
    "txHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "amount": 250
  }
  ```
- **`400 Bad Request`**: Invalid Stellar public key format or score out of bounds.
- **`405 Method Not Allowed`**: Request method is not `POST` or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`429 Too Many Requests`**: Rate limit exceeded (max 10 requests per 60s per address).
- **`500 Internal Server Error`**: Server secret key missing or node RPC failure.
- **`502 Bad Gateway`**: Soroban simulation or transaction submission failure.

#### Code Examples

##### cURL
```bash
curl -X POST "https://slashslice.spicycrust.com/api/mint" \
  -H "Content-Type: application/json" \
  -d '{
    "playerAddress": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L",
    "score": 250
  }'
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    playerAddress: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L',
    score: 250
  })
});
const data = await response.json();
console.log(data);
```

---

### 7. Soroban Cosmetic Badge NFT Minting (`POST /api/mint_nft`)

#### `POST /api/mint_nft`
Mints a non-fungible cosmetic badge NFT on Soroban Testnet when a player achieves a milestone score.

- **HTTP Method**: `POST`
- **Path**: `/api/mint_nft`
- **Content-Type**: `application/json`

#### Request Parameters
| Parameter | In | Type | Required | Description | Validation / Bounds |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `playerAddress` | Body | `string` | **Yes** | Stellar Ed25519 public key | `/^G[A-Z2-7]{55}$/` |

#### Response Status Codes
- **`200 OK`**: NFT badge transaction confirmed on Testnet.
  ```json
  {
    "success": true,
    "message": "¡Transacción NFT confirmada en la Testnet!",
    "txHash": "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
  }
  ```
- **`400 Bad Request`**: Invalid Stellar public key format.
- **`405 Method Not Allowed`**: Request method is not `POST` or `OPTIONS`.
  ```json
  {
    "success": false,
    "error": "Method Not Allowed"
  }
  ```
- **`429 Too Many Requests`**: Rate limit exceeded (max 5 requests per 60s per address).
- **`500 Internal Server Error` / `502 Bad Gateway`**: RPC submission or simulation error.

#### Code Examples

##### cURL
```bash
curl -X POST "https://slashslice.spicycrust.com/api/mint_nft" \
  -H "Content-Type: application/json" \
  -d '{
    "playerAddress": "GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L"
  }'
```

##### TypeScript / JavaScript Fetch
```typescript
const response = await fetch('https://slashslice.spicycrust.com/api/mint_nft', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    playerAddress: 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L'
  })
});
const data = await response.json();
console.log(data);
```

---

## 📊 Complete HTTP Status Codes Matrix

| Status Code | Code Name | Description & Cause | Standard Response Payload |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | Request Succeeded | Successful query or score update. Returns data payload or transaction hash. | `{ "success": true, ... }` |
| **`201 Created`** | Resource Created | User registration or profile creation successfully recorded. | `{ "success": true, "user": { ... } }` |
| **`204 No Content`** | CORS Preflight | CORS `OPTIONS` preflight request processed successfully. | Empty Response |
| **`400 Bad Request`** | Validation Error | Invalid parameter format, missing required field, or score value out of bounds. | `{ "success": false, "error": "..." }` |
| **`404 Not Found`** | Resource Not Found | Target user or player entry not present in Redis database. | `{ "success": false, "error": "User not found" }` |
| **`405 Method Not Allowed`** | Method Forbidden | Calling unsupported HTTP method (e.g. `PUT`, `DELETE`). | `{ "success": false, "error": "Method Not Allowed" }` |
| **`409 Conflict`** | Resource Conflict | Username already registered by another Stellar public key. | `{ "success": false, "error": "Username already taken" }` |
| **`429 Too Many Requests`** | Rate Limited | Address exceeded sliding window mint rate limit. | `{ "success": false, "error": "Rate limit exceeded..." }` |
| **`502 Bad Gateway`** | RPC Gateway Error | Soroban RPC node rejected transaction or simulation failed. | `{ "success": false, "error": "On-chain simulation failed" }` |
| **`500 Internal Error`** | Server Error | Vercel KV connection error or missing server configuration (`ADMIN_SECRET_KEY`). | `{ "success": false, "error": "Internal server error" }` |

---

## 💻 Redis Data Model & Keys Schema Reference

The serverless API suite relies on `@vercel/kv` (Redis) with the following key schema:

| Key Template | Redis Type | Description |
| :--- | :--- | :--- |
| `slashslice:user:<pubkey>` | Hash & String (JSON) | User profile object (`pubkey`, `username`, `avatar`, `privyDid`, `createdAt`, `updatedAt`, `arcadeScore`, `classicScore`). |
| `slashslice:username:<normalized_username>` | String | Case-insensitive username uniqueness mapping (`<normalized_username>` -> `<pubkey>`). |
| `slashslice:privy:<privyDid>` | String | Reverse lookup mapping Privy DID -> `<pubkey>`. |
| `slashslice:leaderboard:<mode>:alltime` | ZSET | All-time leaderboard sorted set (`member`: `<pubkey>`, `score`: highest score). |
| `slashslice:leaderboard:<mode>:weekly:<YYYY-Www>` | ZSET | ISO week leaderboard sorted set. |
| `slashslice:leaderboard:<mode>:daily:<YYYY-MM-DD>` | ZSET | UTC date leaderboard sorted set. |
| `slashslice:scores:<pubkey>` | ZSET | User personal best scores per mode (`member`: `arcade` \| `classic`). |
| `slashslice:leaderboard_v2` | ZSET | Legacy global leaderboard sorted set. |
| `mint:rl:<pubkey>` | String (Integer) | Rate limiting counter for token minting. |
| `mintnft:rl:<pubkey>` | String (Integer) | Rate limiting counter for NFT minting. |
