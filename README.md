# Azul: Queen's Garden 🌺

A digital implementation of the board game **Azul: Queen's Garden** by Michael Kiesling.

Play against 3 AI opponents in your browser — no install required.

## 🎮 How to Play

Open `index.html` in any modern browser.

### Turn Actions (pick one per turn)
1. **Acquire** — Declare a color OR pattern, take all matching tiles (and face-up expansions) from the display
2. **Place Tile** — Select a tile from storage, click a valid hex in your garden to place it
3. **Place Expansion** — Attach a 7-hex expansion to grow your garden
4. **Pass** — End your round (first to pass goes first next round)

### Placement Rules
- Adjacent tiles must share **color OR pattern** (not neither)
- **Identical** tiles cannot be adjacent
- **Jokers** (★) are wild — always valid adjacent
- Placement **cost** = pattern value (Tree=1 free, Bird=2 needs 1 payment tile, etc.)
- Payment tiles must share a single attribute (all same color OR all same pattern)

### Scoring
- **End of round:** Rotary wheel shows 3 attributes with point values — earn points per matching hex
- **Pavilions/Fountain:** +1 pt each, every round
- **Final scoring:** Connected groups of 3+ same color → 3 pts (same for patterns)
- **All-6 bonus:** Group containing all 6 of a type → +6 pts
- **Leftover penalties:** −1 per tile, −3 per expansion remaining in storage

## 🤖 AI Opponents

| AI | Strategy |
|----|----------|
| **Greedy** | Prioritizes tiles matching the current scoring wheel |
| **Builder** | Focuses on building large connected groups for end-game |
| **Balanced** | Manages storage efficiently, mix of strategies |

Click the **opponent tabs** above the garden to inspect any AI's board.

## 🛠 Development Phases

- [x] Phase 1: Core hex grid + tile data model (108 tiles, 24 jokers, adjacency)
- [x] Phase 2: Drafting system (display, expansions, acquire action)
- [x] Phase 3: Placement + cost system (payment tiles, expansion placement)
- [x] Phase 4: Scoring + game rounds (rotary wheel, round/final scoring)
- [x] Phase 5: AI opponents (3 personalities, viewable gardens)
- [x] Phase 6: Polish (animations, game over, responsive, SVG patterns)

## ⚙️ Tech

Pure HTML/CSS/JS — no frameworks, no build tools, no external dependencies.
- SVG hex grid rendering
- CSP-compliant (no innerHTML, no inline handlers)
- Responsive layout (desktop → tablet → mobile)
- 33 unit tests across 3 test files

## 📋 Game Components

- **108 Hex Tiles:** 6 colors × 6 patterns × 3 copies
- **24 Joker Tiles:** Gray/wild
- **36 Garden Expansions:** 7-hex pieces, 9 per round
- **Scoring Wheel:** 12 attributes, 3 scored per round

### Colors
| Color | Hex |
|-------|-----|
| Lavender | `#B39DDB` |
| Purple | `#7B1FA2` |
| Light Green | `#81C784` |
| Dark Green | `#2E7D32` |
| Light Blue | `#64B5F6` |
| Yellow | `#FFD54F` |

### Patterns (with costs)
| Pattern | Cost | Icon |
|---------|------|------|
| Tree | 1 (free) | 🌲 |
| Bird | 2 | 🐦 |
| Butterfly | 3 | 🦋 |
| Flower | 4 | 🌸 |
| Grass | 5 | 🌿 |
| Tulip | 6 | 🌷 |
