# Azul: Queen's Garden — Automated Test Results

## Test Summary

**Date:** 2026-05-22  
**Test harness:** `test-automated.js` (detailed), `test-stress.js` (batch)  
**Results:** ✅ ALL PASSED

## Test Coverage

### Manual Loop Tests (test-automated.js)
- 3 games with our own turn management loop
- Validates: AI decisions, acquire logic, tile placement, expansion placement, payment indices, storage bounds, adjacent tile rules, round scoring, final scoring
- State validation every 20 turns + end-of-game

### Native Loop Tests (test-automated.js)
- 3 games using the game's actual `aiTurn()` → `endTurn()` → `aiTurn()` chain
- Validates the real game flow code path

### Stress Test (test-stress.js)
- 20 games with full validation
- **20/20 passed, 0 errors**
- ~160-172 turns per game
- Scores range: 62–151 pts per player

## What Was Validated

| Check | Status |
|-------|--------|
| Game initializes correctly | ✅ |
| 4 rounds complete | ✅ |
| AI acquire (color/pattern matching) | ✅ |
| Tile deduplication (one per color+pattern combo) | ✅ |
| AI tile placement with adjacency rules | ✅ |
| Cost payment system (correct indices) | ✅ |
| No storage overflow (max 12 tiles) | ✅ |
| No expansion storage overflow (max 2) | ✅ |
| Expansion placement (7-hex flower, no overlap) | ✅ |
| AI expansion pickup (face-up only) | ✅ |
| Stack → display → face-up lifecycle | ✅ |
| No identical adjacent tiles | ✅ |
| End-of-round scoring (wheel attributes) | ✅ |
| Final scoring (connected groups) | ✅ |
| Leftover penalties | ✅ |
| Winner determination | ✅ |
| No infinite loops | ✅ |

## Known Design Notes (Not Bugs)

1. **Player 0 as AI**: When player 0 is set to `isHuman=false` in native mode, `aiTurn()` creates separate `aiStorage`/`aiGarden` instead of using `State.storage`/`State.garden`. This means player 0's AI doesn't use the 3 starting jokers from init. This is by design — player 0 is always human in the real game.

2. **AI strategy is basic**: AI plays legally but doesn't optimize deeply. Greedy favors scoring wheel matches, Builder favors existing colors, Balanced just counts. Scores are reasonable (60-150 range).

## Bugs Fixed During This Session

_(Bugs fixed in prior commits before test harness was built)_

1. **Acquire flow redesign** — Replaced dropdown-first with click-first tile selection
2. **Decoupled tile/expansion acquisition** — Split into separate actions
3. **Duplicate tile rule** — Added dedup in `getAcquireMatches()`
4. **Expansion slot listener stacking** — Clone DOM elements to prevent enter/cancel race
5. **Expansion placement validation** — Rewrote `findValidExpansionCenters()` with proper 7-hex flower no-overlap + adjacency checks
