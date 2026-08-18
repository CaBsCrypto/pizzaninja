# Analysis Report: Web3 Wallet Login & Profile Registration Integration

## 1. Observation

### Key Files & Locations
- **`src/components/StellarHub.tsx`**: Main React component managing wallet connections (Privy Google OAuth, Freighter extension, Passkey smart wallet), public key state, profile existence checks, and the profile registration / editing UI.
- **`api/user.ts`**: Vercel serverless function handling `GET /api/user` (profile lookup and stats calculation) and `POST /api/user` (user profile creation, avatar selection, Privy DID linking, and case-insensitive username uniqueness indexing in Vercel KV).
- **`src/App.tsx`**: Top-level application component that instantiates `walletState` (`StellarWalletState`) and renders `<StellarHub />` inside a slide-out drawer.

### 1.1 Stellar Wallet Connection State Establishment
In `src/components/StellarHub.tsx`:
- `StellarWalletState` interface (lines 15-20):
  ```typescript
  export interface StellarWalletState {
    connected: boolean;
    publicKey: string | null;
    walletType: 'freighter' | 'passkey' | 'gmail' | null;
    domainName?: string;
  }
  ```
- Component props contract (lines 22-26):
  ```typescript
  interface StellarHubProps {
    walletState: StellarWalletState;
    setWalletState: React.Dispatch<React.SetStateAction<StellarWalletState>>;
    onToastMessage: (message: string, type: 'success' | 'info' | 'error') => void;
  }
  ```
- Managed in parent `src/App.tsx` (lines 72-76):
  ```typescript
  const [walletState, setWalletState] = useState<StellarWalletState>({
    connected: false,
    publicKey: null,
    walletType: null
  });
  ```
- Three connection avenues exist in `StellarHub.tsx`:
  1. **Google / Gmail Authentication (Privy SSO)**:
     - `handleConnectGmail` (lines 159-176) invokes `login()` from `usePrivy()`.
     - `useEffect` (lines 109-157) monitors `ready`, `authenticated`, and `user`. When authenticated, it deterministically derives an Ed25519 seed from SHA-256 hash of `user.id + "_spicycrust_privy_shared_salt_2026"` using `Keypair.fromRawEd25519Seed(...)`.
     - Sets cookie `stellar_wallet=<pubKey>` (`path=/`, `max-age=86400`, `Secure`, `SameSite=Lax`, optional `domain=.spicycrust.com`).
     - Updates state via `setWalletState({ connected: true, publicKey: pubKey, walletType: 'gmail' })`.
     - Cookie fast-track SSO check via `getWalletCookie()` (lines 10-13, 111-118) detects active session on mount.
  2. **Web3 Extensions (Freighter / Albedo / xBull)**:
     - `handleConnectWallet` (lines 178-198) calls `kit.openModal(...)` using Stellar Wallet Kit.
     - On selection, calls `kit.setWallet(option.id)` and `kit.getAddress()`.
     - Updates state via `setWalletState({ connected: true, publicKey: address, walletType: 'freighter' })`.
  3. **Passkey Smart Wallet (Demo Mode)**:
     - `handleConnectPasskey` (lines 200-241) invokes `navigator.credentials.create(...)`.
     - Derives a 56-character mock Stellar public key string starting with `G...` from SHA-256 hash of credential ID.
     - Updates state via `setWalletState({ connected: true, publicKey: mockStellarPubKey, walletType: 'passkey' })`.
  4. **Disconnection Handler**:
     - `handleDisconnect` (lines 243-264) deletes `stellar_wallet` cookie, calls `kit.disconnect()`, invokes Privy `logout()` if `walletType === 'gmail'`, resets profile states, and sets `setWalletState({ connected: false, publicKey: null, walletType: null })`.

### 1.2 Profile Lookup via `GET /api/user?pubkey=<pubkey>`
In `src/components/StellarHub.tsx` (lines 68-107):
- A `useEffect` hook responds to changes in `[walletState.connected, walletState.publicKey]`:
  ```typescript
  useEffect(() => {
    if (!walletState.connected || !walletState.publicKey) {
      setUserProfile(null);
      setUserStats(null);
      setShowRegisterForm(false);
      setIsCheckingProfile(false);
      return;
    }

    const checkUserProfile = async () => {
      setIsCheckingProfile(true);
      setRegistrationError(null);
      try {
        const res = await fetch(`/api/user?pubkey=${encodeURIComponent(walletState.publicKey!)}`);
        const data = await res.json();

        if (res.status === 200 && data.success && data.user) {
          setUserProfile(data.user);
          setUserStats({
            arcadeScore: data.stats?.arcadeScore ?? data.scores?.arcade ?? 0,
            classicScore: data.stats?.classicScore ?? data.scores?.classic ?? 0,
            globalRank: data.stats?.globalRank ?? data.rank?.arcade ?? null
          });
          setShowRegisterForm(false);
        } else {
          // Profile not registered yet
          setUserProfile(null);
          setUserStats(null);
          setShowRegisterForm(true);
        }
      } catch (e) {
        console.error("Error checking user profile existence:", e);
        setShowRegisterForm(true);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [walletState.connected, walletState.publicKey]);
  ```
- In `api/user.ts` (lines 139-234):
  - Validates `pubkey` parameter format (`/^G[A-Z2-7]{55}$/`).
  - Reads Redis key `slashslice:user:<pubkey>`.
  - Calculates high scores (`arcadeScore`, `classicScore`) from `slashslice:leaderboard:<mode>:alltime` and rank via `zrevrank`.
  - Returns 200 `{ success: true, user: profile, stats: { arcadeScore, classicScore, globalRank } }` if found.
  - Returns 404 `{ success: false, error: 'User not found' }` if user key does not exist.

### 1.3 Profile Registration Prompt & `POST /api/user` Integration
In `src/components/StellarHub.tsx`:
- When `GET /api/user` returns 404 (or user not found), `showRegisterForm` is set to `true`.
- Form UI rendering (lines 464-552):
  - Renders inline registration modal component when `showRegisterForm` or `isEditingProfile` is `true`.
  - Username input field: bounded to 3-15 chars (`maxLength={15}`), regex validation `/^[a-zA-Z0-9_]{3,15}$/`.
  - Avatar selector grid (`AVATAR_OPTIONS`): 4 selectable avatars (`ninja_default` 🥷, `chef_pizza` 🍕, `blade_master` ⚔️, `stellar_legend` 👑).
  - Submit button with loading spinner (`isSubmittingReg`) and error alert banner (`registrationError`).
- Submission handler `handleRegisterProfile` (lines 266-329):
  ```typescript
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationError(null);

    const username = inputUsername.trim();
    // Front-end validations (empty, length 3-15, regex /^[a-zA-Z0-9_]{3,15}$/, active pubkey)
    ...
    setIsSubmittingReg(true);
    try {
      const privyDid = user?.id;
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: walletState.publicKey,
          username,
          avatar: selectedAvatar,
          privyDid
        })
      });
      const data = await res.json();
      if (res.status === 201 && data.success && data.user) {
        setUserProfile(data.user);
        setUserStats({ arcadeScore: 0, classicScore: 0, globalRank: null });
        setShowRegisterForm(false);
        setIsEditingProfile(false);
        onToastMessage(`¡Perfil @${data.user.username} creado exitosamente! 🥷`, 'success');
      } else if (res.status === 409) {
        setRegistrationError("Ese nombre de usuario ya está ocupado.");
      } else {
        setRegistrationError(data.error || "Error al registrar perfil.");
      }
    } catch (err) {
      setRegistrationError("Error de conexión al guardar perfil.");
    } finally {
      setIsSubmittingReg(false);
    }
  };
  ```
- Backend Handler in `api/user.ts` (lines 34-137):
  - Validates `pubkey` regex `/^G[A-Z2-7]{55}$/` and `username` regex `/^[a-zA-Z0-9_]{3,15}$/`.
  - Converts username to lowercase for index key `slashslice:username:<normalized_username>`.
  - Checks if username is taken by a different `pubkey` (returns 409 Conflict if occupied).
  - Writes profile to `slashslice:user:<pubkey>` (stringified JSON & Hash), updates reverse index `slashslice:username:<normalized_username>` -> `pubkey`, and `slashslice:privy:<privyDid>` -> `pubkey`.
  - Returns 201 Created `{ success: true, user: profile }`.

## 2. Logic Chain

1. **State Flow & Initialization**:
   - Connection state originates in `App.tsx` (`walletState`) and is mutated through `setWalletState` passed to `StellarHub.tsx`.
   - On wallet connection (Privy, Freighter, or Passkey), `walletState.connected` becomes `true` and `walletState.publicKey` is set to a 56-character Stellar address (`G...`).

2. **Automatic User Profile Verification**:
   - The reactive `useEffect` in `StellarHub.tsx` triggers `GET /api/user?pubkey=<pubkey>` immediately upon connection.
   - If the backend returns `200 OK`, `userProfile` and `userStats` state variables are populated, and `showRegisterForm` remains `false`. The user profile badge is displayed with avatar, username, global rank, and high scores.
   - If the backend returns `404 Not Found`, the user is recognized as a new wallet address. `setUserProfile(null)` and `setShowRegisterForm(true)` are called.

3. **Prompted Registration & Creation**:
   - Setting `showRegisterForm(true)` causes `StellarHub.tsx` to render the profile registration form inside the drawer.
   - The user inputs a unique username (3-15 alphanumeric chars or `_`) and selects an avatar emoji.
   - Submitting the form calls `POST /api/user` with body `{ pubkey, username, avatar, privyDid }`.
   - On `201 Created`, the local component updates `userProfile` to the returned user object, sets `showRegisterForm(false)`, and displays a success toast.
   - On `409 Conflict` (duplicate username), the form displays `"Ese nombre de usuario ya está ocupado."` without closing, allowing the user to choose another moniker.

4. **Integration Cohesion**:
   - The frontend regex `/^[a-zA-Z0-9_]{3,15}$/` in `StellarHub.tsx` (line 282) precisely matches the backend regex in `api/user.ts` (line 4).
   - The Stellar public key regex `/^G[A-Z2-7]{55}$/` in `api/user.ts` (line 3) matches standard ED25519 addresses produced by Freighter and derived by Privy key derivation.

## 3. Caveats

1. **Local State vs Global App Sync**:
   - Currently, `userProfile` is stored inside `StellarHub` component local state. When game score submissions occur in `App.tsx` (or `api/score.ts`), `App.tsx` relies on `chefName` input or `walletState.publicKey`. Synchronizing the registered `@username` directly to `App.tsx` state or score submission forms ensures seamless score attribution.
2. **Mock Passkey Pubkeys**:
   - `handleConnectPasskey` generates mock public keys (`G...`). These are formatted as valid 56-character ED25519 strings so that `api/user.ts` regex checks pass during demo/testing.
3. **Privy App ID Environment Variable**:
   - In production builds, `VITE_PRIVY_APP_ID` must be configured in Vercel environment variables for Privy Google SSO login to initialize properly.

## 4. Conclusion

`StellarHub.tsx` and `api/user.ts` fully specify the Web3 wallet login and profile registration workflow:
1. **Wallet Connection State**: Controlled in `App.tsx` (`StellarWalletState`) and established via Privy (Google SSO + Ed25519 key derivation), Stellar Wallet Kit (Freighter extension), or Passkey WebAuthn.
2. **Profile Existence Check**: Handled automatically via `useEffect` executing `GET /api/user?pubkey=<pubkey>` upon wallet connection.
3. **Registration Trigger & Submission**: Prompted via embedded inline form when `GET /api/user` yields 404, posting `{ pubkey, username, avatar, privyDid }` to `POST /api/user` with client & server validation and 409 conflict handling.

## 5. Verification Method

### 5.1 Automated Test Execution
Run the existing test suite via node test runner to verify API endpoints and mock server handlers:
```powershell
npm test
```
Or specifically execute the Tier 1 E2E tests:
```powershell
node --import tsx --test tests/e2e/tier1_features.test.ts
```

### 5.2 Manual / UI Verification Steps
1. Start the local dev server:
   ```powershell
   npm run dev
   ```
2. Open http://localhost:5173 and click on the **Stellar Hub** (Wallet) icon in the top header.
3. Connect a wallet (e.g. Google Login via Privy, or Web3 Wallet / Passkey demo).
4. Verify that `GET /api/user?pubkey=<pubkey>` is requested in the browser Network tab.
5. If the wallet is unregistered, confirm that the "Registrar Nuevo Perfil" form appears with Username and Avatar inputs.
6. Enter an invalid username (e.g., `a!`) and confirm validation error display.
7. Enter a valid username (e.g., `Ninja_123`), choose an avatar, and click "Registrar Perfil".
8. Confirm HTTP `POST /api/user` returns 201 Created and the UI transitions to the registered user profile card showing `@Ninja_123` and high score stats.
