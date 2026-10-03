Surendra Created World — Tambola Multiplayer V3.2

Run:
  npm install
  npm start

Open http://localhost:3000

Final fixes in this build:
- Separate Create Room / Join Room pages; landing page disappears when a mode is selected.
- Host Playing Mode shows only the host's own tickets; other players receive only ticket counts.
- Host can manually mark called numbers on host tickets; called numbers are highlighted but never auto-marked.
- Claim panel is on the side, not below tickets. Early 5, First Line, Second Line, Third Line and Full House activate only when the player's marked ticket is eligible, then disable for everyone after a successful claim.
- Number calling has an ON/OFF speech-sound control.
- Previous Numbers shows all 1–90 numbers in order, highlights called numbers, and shows called order.
- Reset Game clears numbers/claims and generates fresh tickets for every player while syncing the new game state.
- Host has a slide-out Live Chat; players keep their Live Chat panel.
- Host-only controls (reset, number generation, management) are not exposed to players.
- Player +/− ticket management works correctly in Management Mode.
- Chat and game state are synchronized through Socket.IO.
