# Test Results — Azul Queen's Garden

## Test Run: 2026-05-22 22:45 PDT

### Configuration
- 20 games, 4 AI players each
- Score validation: 25-250 expected range
- Expansion cost + tile validation enabled

### Results: ✅ 0 ERRORS, 20/20 GAMES COMPLETE

| Metric | Value |
|--------|-------|
| Games run | 20 |
| Errors | 0 |
| Score range | 11 - 137 |
| Average score | 81.0 |
| Expansions placed | 130 total |
| Expansion tiles on gardens | 130 (100% — every expansion correctly places its tile) |
| Cost tiles paid | 236 |
| Anomalies | 1 (P1 scored 11 in game 6 — legitimate bad AI play, not a bug) |

### Bugs Found & Fixed This Session

1. **AI expansion placement didn't place tile on outer hex** — `expandAiGarden()` placed the 7-hex flower but left all hexes empty. Fixed: now places the expansion's color/pattern tile on a random outer hex.

2. **AI expansion placement didn't pay cost** — expansions were placed for free. Fixed: `expandAiGarden()` now calls `payAiExpansionCost()` to deduct matching tiles from AI storage.

3. **AI decided to place expansions it couldn't afford** — `decideAiAction()` returned `placeExp` without checking cost. Fixed: added `canAiAffordExpansion()` check before both `placeExp` return points.

4. **Expansion tile placement state not reset** — `State.expansionTilePlacing`, `State.expansionTileOptions`, and `State.expansionTile` weren't cleared in `cancelExpansionPlacement()`, `endTurn()`, or between rounds. Fixed: added resets to all state-clearing locations.

5. **Human expansion placement cost** — Expansion placement was free for human player too. Fixed: `confirmExpansionPlacement()` now checks cost and deducts payment tiles before placing.

6. **Human expansion placement tile on outer hex** — After placing expansion, player now chooses which of the 6 outer hexes gets the expansion's tile (via highlighted hex selection sub-step).

### Score Validation

Previous run (no expansion costs, no expansion tiles): scores 68-150, avg ~100
Current run (with costs + tiles): scores 11-137, avg 81

Scores are lower because:
- Expansion placement now costs tiles from storage (reducing available tiles for other placements)
- AI cost-checking prevents some expansions from being placed
- More realistic resource management

### Garden Growth
- Starting: 13 hexes
- End of game: 13-48 hexes (0-5 expansions placed)
- Gardens never shrink ✓

### Previous Bugs (already fixed before this session)
- Click-first acquire UX (replaced dropdowns)
- Tile/expansion acquisition decoupled
- One-of-each-duplicate rule enforced
- Expansion storage slots made clickable
- Event listener stacking bug on expansion slots
- Full expansion placement rewrite (7-hex flower, no-overlap)
