# Dispatch for Explorer M3-2

## Mission
Investigate `src/components/StellarHub.tsx` existing implementation, Web3 wallet login flow, connection state hooks, profile registration trigger requirement (checking GET /api/user?pubkey=... and prompting registration modal/form calling POST /api/user if 404), and React/UI component conventions.

## Scope & References
- PROJECT.md at root
- ORIGINAL_REQUEST.md at root
- `src/components/StellarHub.tsx`
- `api/user.ts`
- `tests/`

## 2026-08-11T04:50:45Z
Investigate `src/components/StellarHub.tsx`, `api/user.ts`, and frontend React component architecture to analyze how Web3 wallet login and profile registration prompt integration should work:
1. How Stellar wallet connection state is established in `StellarHub.tsx`.
2. How wallet login checks `GET /api/user?pubkey=<pubkey>`.
3. If 404 (user not found), how `StellarHub.tsx` prompts profile registration (username/avatar input modal/form calling `POST /api/user`).
4. Return a detailed analysis report and implementation strategy in `handoff.md` within your working directory. Send a message to parent when done.

