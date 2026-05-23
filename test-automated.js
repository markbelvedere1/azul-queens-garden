#!/usr/bin/env node
/**
 * Automated test harness for Azul: Queen's Garden
 * Extracts game logic from index.html and runs full 4-AI-player games.
 * 
 * Mode 1: Manual AI loop (our own turn management, catches logic bugs)
 * Mode 2: Native game loop (uses aiTurn() + endTurn(), catches flow bugs)
 */

const fs = require('fs');
const path = require('path');

// ---- Extract JS from index.html ----
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error('No <script> found'); process.exit(1); }
let jsCode = scriptMatch[1];

// ---- Build DOM stubs ----
function createDomStubs() {
  const domElements = {};
  function stubGetElement(id) {
    if (!domElements[id]) {
      domElements[id] = {
        textContent: '',
        innerHTML: '',
        disabled: false,
        style: new Proxy({}, { get: () => '', set: () => true }),
        children: [],
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); },
          toggle(c) { this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c); }
        },
        appendChild(child) { this.children.push(child); return child; },
        removeChild(child) { this.children = this.children.filter(c => c !== child); return child; },
        insertBefore(a, b) { this.children.push(a); return a; },
        replaceChild(newC, oldC) { this.children = this.children.map(c => c === oldC ? newC : c); return oldC; },
        cloneNode(deep) { 
          const clone = stubGetElement('clone_' + Math.random().toString(36).slice(2));
          clone.textContent = this.textContent;
          return clone;
        },
        get firstChild() { return this.children[0] || null; },
        get parentNode() { return { replaceChild(n, o) { return n; }, removeChild(c) { return c; } }; },
        addEventListener() {},
        removeEventListener() {},
        setAttribute() {},
        getAttribute() { return ''; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        get id() { return id; },
        set id(v) {},
        get offsetWidth() { return 800; },
        get offsetHeight() { return 600; }
      };
    }
    return domElements[id];
  }

  const documentStub = {
    getElementById(id) { return stubGetElement(id); },
    createElement(tag) { return stubGetElement('el_' + tag + '_' + Math.random().toString(36).slice(2)); },
    createElementNS(ns, tag) { return stubGetElement('ns_' + tag + '_' + Math.random().toString(36).slice(2)); },
    createTextNode(t) { return { textContent: t, nodeType: 3 }; },
    body: {
      appendChild(child) {},
      removeChild(child) {},
      children: []
    },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; }
  };

  return { documentStub, stubGetElement };
}

// ---- Compile and run game code in a function scope ----
function createGameInstance(captureLog) {
  const { documentStub } = createDomStubs();

  let code = jsCode;

  // Remove event listener registrations
  code = code.replace(/document\.getElementById\('btnNewGame'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('btnPass'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('btnPlaceExp'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('btnPlace'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('tabYou'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('tabAI1'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('tabAI2'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/document\.getElementById\('tabAI3'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/\/\/ === INIT ===\s*\ninitGame\(\);/, '// === INIT === (removed for test)');

  // Replace setTimeout for AI to call immediately  
  code = code.replace(/setTimeout\(function\(\)\s*\{\s*aiTurn\(\);\s*\},\s*\d+\);/g, 'aiTurn();');

  const wrappedCode = `
    (function(document, setTimeout, clearTimeout, window) {
      var __capturedLog = [];
      
      ${code}
      
      // Patch addLog to also capture
      var _origAddLog = addLog;
      addLog = function(msg) {
        __capturedLog.push(msg);
        _origAddLog(msg);
      };
      
      return {
        State, initGame, endTurn, endRound,
        aiTurn, getAcquireMatches, executeAcquire, executeAcquireExpansion,
        canPlaceTile, getValidPlacements, placeTile,
        findValidExpansionCenters, enterExpansionPlacementMode, confirmExpansionPlacement,
        placeExpansion, decideAiAction, findAiPlacement, findAiAcquire,
        hexNeighbors, hexKey, addLog: addLog,
        scoreEndOfRound, scoreFinalGroups, scoreLeftovers,
        renderAll, expandAiGarden, initAiGarden, countGardenSize,
        __capturedLog
      };
    })
  `;

  try {
    const factory = eval(wrappedCode);
    return factory(documentStub, (fn) => fn(), () => {}, { innerWidth: 1024, innerHeight: 768 });
  } catch (e) {
    console.error('Failed to compile game code:', e.message);
    throw e;
  }
}

// ---- Validation helpers ----
function validateGameState(g, context, errors) {
  const S = g.State;

  // Check storage bounds
  if (S.storage.length > 12) {
    errors.push({ context, message: `Player 0 storage overflow: ${S.storage.length}/12` });
  }
  if (S.expansionStorage.length > 2) {
    errors.push({ context, message: `Player 0 expansion storage overflow: ${S.expansionStorage.length}/2` });
  }

  // Check AI storage bounds
  for (let i = 1; i < S.players.length; i++) {
    const p = S.players[i];
    if (p.aiStorage && p.aiStorage.length > 12) {
      errors.push({ context, message: `${p.name} storage overflow: ${p.aiStorage.length}/12` });
    }
    if (p.aiExpStorage && p.aiExpStorage.length > 2) {
      errors.push({ context, message: `${p.name} expansion storage overflow: ${p.aiExpStorage.length}/2` });
    }
  }

  // Check no duplicate tiles on same hex
  const gardens = [{ name: 'Player', garden: S.garden }];
  for (let i = 1; i < S.players.length; i++) {
    if (S.players[i].aiGarden) {
      gardens.push({ name: S.players[i].name, garden: S.players[i].aiGarden });
    }
  }
  for (const { name, garden } of gardens) {
    garden.forEach((cell, key) => {
      if (cell.tile) {
        const nbrs = g.hexNeighbors(cell.q, cell.r);
        for (const n of nbrs) {
          const nc = garden.get(g.hexKey(n.q, n.r));
          if (nc && nc.tile && !cell.tile.isJoker && !nc.tile.isJoker) {
            if (nc.tile.color === cell.tile.color && nc.tile.pattern === cell.tile.pattern) {
              errors.push({ context, message: `${name}: identical adjacent tiles at ${key} and ${g.hexKey(n.q, n.r)}` });
            }
          }
        }
      }
    });
  }
}

// ---- Mode 1: Manual AI Loop ----
function runManualGame(gameNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GAME ${gameNum} (Manual Loop)`);
  console.log(`${'='.repeat(60)}`);

  const g = createGameInstance();
  const errors = [];
  let turnCount = 0;
  const maxTurns = 2000;

  try {
    g.initGame();
    g.State.players[0].isHuman = false;
    g.State.players[0].name = 'AI-Player0';

    while (g.State.round <= 4 && turnCount < maxTurns) {
      turnCount++;
      const p = g.State.currentPlayer;
      const pName = g.State.players[p].name;

      if (g.State.roundPassed.every(x => x)) {
        try {
          g.endRound();
        } catch (e) {
          errors.push({ turn: turnCount, message: `endRound failed: ${e.message}`, stack: e.stack });
        }
        if (g.State.round > 4) break;
        continue;
      }

      if (g.State.roundPassed[p]) {
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
        continue;
      }

      // Init AI state
      if (!g.State.players[p].aiStorage) g.State.players[p].aiStorage = [];
      if (!g.State.players[p].aiExpStorage) g.State.players[p].aiExpStorage = [];
      if (!g.State.players[p].aiGarden) g.initAiGarden(p);

      let aiStorage = p === 0 ? g.State.storage : g.State.players[p].aiStorage;
      let aiExpStorage = p === 0 ? g.State.expansionStorage : g.State.players[p].aiExpStorage;
      let aiGarden = p === 0 ? g.State.garden : g.State.players[p].aiGarden;

      if (p === 0) {
        g.State.players[0].aiStorage = aiStorage;
        g.State.players[0].aiExpStorage = aiExpStorage;
        g.State.players[0].aiGarden = aiGarden;
      }

      let action;
      try {
        action = g.decideAiAction(p, aiStorage, aiExpStorage, aiGarden);
      } catch (e) {
        errors.push({ turn: turnCount, message: `${pName} decideAiAction failed: ${e.message}`, stack: e.stack });
        g.State.roundPassed[p] = true;
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
        continue;
      }

      if (!action) {
        g.State.roundPassed[p] = true;
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
        continue;
      }

      try {
        if (action.type === 'acquire') {
          const matches = g.getAcquireMatches(action.attrType, action.attrValue);
          if (matches.tiles.length === 0) {
            errors.push({ turn: turnCount, message: `${pName} acquire found 0 matches for ${action.attrType}=${action.attrValue}` });
            g.State.roundPassed[p] = true;
          } else {
            let collected = 0;
            let tookStack = false;
            const sTiles = matches.tiles.filter(m => m.source === 'stack');
            const dTiles = matches.tiles.filter(m => m.source === 'display');

            sTiles.sort((a, b) => b.tileIdx - a.tileIdx);
            for (const st of sTiles) {
              if (aiStorage.length < 12) { aiStorage.push(st.tile); collected++; }
              if (g.State.expansionStack.length > 0) g.State.expansionStack[0].tilesOnTop.splice(st.tileIdx, 1);
              tookStack = true;
            }

            const byExp = {};
            for (const dt of dTiles) {
              if (!byExp[dt.expIdx]) byExp[dt.expIdx] = [];
              byExp[dt.expIdx].push(dt);
            }
            for (const k of Object.keys(byExp).sort((a, b) => parseInt(b) - parseInt(a))) {
              byExp[k].sort((a, b) => b.tileIdx - a.tileIdx);
              for (const dt of byExp[k]) {
                if (aiStorage.length < 12) { aiStorage.push(dt.tile); collected++; }
                if (g.State.displayExpansions[parseInt(k)]) g.State.displayExpansions[parseInt(k)].tilesOnTop.splice(dt.tileIdx, 1);
              }
            }

            if (tookStack && g.State.expansionStack.length > 0) {
              const moved = g.State.expansionStack.shift();
              g.State.displayExpansions.push(moved);
              if (g.State.expansionStack.length > 0) {
                const top = g.State.expansionStack[0];
                for (let t = 0; t < 4; t++) { if (g.State.bag.length) top.tilesOnTop.push(g.State.bag.pop()); }
              }
            }
            for (const de of g.State.displayExpansions) {
              if (!de.faceUp && (!de.tilesOnTop || de.tilesOnTop.length === 0)) de.faceUp = true;
            }
          }

        } else if (action.type === 'acquireExp') {
          const idx = action.expIndex;
          if (idx >= 0 && idx < g.State.displayExpansions.length && g.State.displayExpansions[idx].faceUp && aiExpStorage.length < 2) {
            aiExpStorage.push(g.State.displayExpansions.splice(idx, 1)[0]);
          } else {
            g.State.roundPassed[p] = true;
          }

        } else if (action.type === 'place') {
          const tile = aiStorage[action.tileIdx];
          if (!tile) {
            errors.push({ turn: turnCount, message: `${pName} place: invalid tileIdx ${action.tileIdx}, storage=${aiStorage.length}` });
            g.State.roundPassed[p] = true;
          } else {
            const cell = aiGarden.get(g.hexKey(action.target.q, action.target.r));
            if (!cell || cell.tile) {
              errors.push({ turn: turnCount, message: `${pName} place: invalid target (${action.target.q},${action.target.r})` });
              g.State.roundPassed[p] = true;
            } else {
              cell.tile = tile;
              const removeIdxs = [action.tileIdx].concat(action.paymentIdxs || []);
              removeIdxs.sort((a, b) => b - a);
              for (const ri of removeIdxs) {
                if (ri < aiStorage.length) aiStorage.splice(ri, 1);
                else errors.push({ turn: turnCount, message: `${pName} payment idx ${ri} OOB (len=${aiStorage.length})` });
              }
            }
          }

        } else if (action.type === 'placeExp') {
          if (aiExpStorage.length === 0) {
            errors.push({ turn: turnCount, message: `${pName} placeExp with empty storage` });
            g.State.roundPassed[p] = true;
          } else {
            aiExpStorage.splice(0, 1);
            try {
              g.expandAiGarden(p, aiGarden);
            } catch (e) {
              errors.push({ turn: turnCount, message: `${pName} expandAiGarden failed: ${e.message}`, stack: e.stack });
            }
          }

        } else if (action.type === 'pass') {
          g.State.roundPassed[p] = true;
        } else {
          errors.push({ turn: turnCount, message: `Unknown action type: ${action.type}` });
          g.State.roundPassed[p] = true;
        }
      } catch (e) {
        errors.push({ turn: turnCount, message: `${pName} action '${action.type}' threw: ${e.message}`, stack: e.stack });
        g.State.roundPassed[p] = true;
      }

      // Validate state periodically
      if (turnCount % 20 === 0) validateGameState(g, `turn ${turnCount}`, errors);

      // Advance
      let next = (g.State.currentPlayer + 1) % 4;
      let guard = 0;
      while (g.State.roundPassed[next] && guard < 4) { next = (next + 1) % 4; guard++; }
      if (guard >= 4) {
        try { g.endRound(); } catch (e) {
          errors.push({ turn: turnCount, message: `endRound failed: ${e.message}`, stack: e.stack });
          break;
        }
      } else {
        g.State.currentPlayer = next;
      }
    }

    if (turnCount >= maxTurns) {
      errors.push({ turn: turnCount, message: 'Max turns exceeded — infinite loop' });
    }

    // Final validation
    validateGameState(g, 'end of game', errors);

    console.log(`Game ${gameNum} finished in ${turnCount} turns.`);
    for (let i = 0; i < g.State.players.length; i++) {
      console.log(`  ${g.State.players[i].name}: ${g.State.players[i].score} pts`);
    }

  } catch (e) {
    errors.push({ turn: turnCount, message: `Unhandled: ${e.message}`, stack: e.stack });
  }

  return { game: gameNum, mode: 'manual', success: errors.length === 0, turns: turnCount, errors };
}

// ---- Mode 2: Native Game Loop (uses aiTurn + endTurn) ----
function runNativeGame(gameNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GAME ${gameNum} (Native Loop — aiTurn/endTurn)`);
  console.log(`${'='.repeat(60)}`);

  const g = createGameInstance();
  const errors = [];
  let turnCount = 0;
  const maxTurns = 2000;

  try {
    g.initGame();
    // Make player 0 an AI too
    g.State.players[0].isHuman = false;
    g.State.players[0].name = 'AI-Native0';

    // The native aiTurn calls endTurn which calls aiTurn for the next AI.
    // So calling aiTurn once should chain the whole round. But we need to handle round transitions.
    while (g.State.round <= 4 && turnCount < maxTurns) {
      turnCount++;
      const p = g.State.currentPlayer;

      if (g.State.roundPassed.every(x => x)) {
        g.endRound();
        if (g.State.round > 4) break;
        continue;
      }

      if (g.State.roundPassed[p]) {
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
        continue;
      }

      const prevRound = g.State.round;
      const prevPlayer = g.State.currentPlayer;
      
      try {
        // Call the game's actual aiTurn
        g.aiTurn();
      } catch (e) {
        errors.push({ turn: turnCount, message: `aiTurn threw for player ${p}: ${e.message}`, stack: e.stack });
        g.State.roundPassed[p] = true;
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
      }

      // Detect stuck state (same player, same round, not passed — infinite loop)
      if (g.State.currentPlayer === prevPlayer && g.State.round === prevRound && !g.State.roundPassed[p]) {
        errors.push({ turn: turnCount, message: `Stuck: player ${p} didn't advance after aiTurn` });
        g.State.roundPassed[p] = true;
        g.State.currentPlayer = (g.State.currentPlayer + 1) % 4;
      }

      if (turnCount % 20 === 0) validateGameState(g, `native turn ${turnCount}`, errors);
    }

    if (turnCount >= maxTurns) {
      errors.push({ turn: turnCount, message: 'Max turns exceeded — infinite loop' });
    }

    validateGameState(g, 'native end of game', errors);

    console.log(`Game ${gameNum} finished in ${turnCount} turns.`);
    for (let i = 0; i < g.State.players.length; i++) {
      console.log(`  ${g.State.players[i].name}: ${g.State.players[i].score} pts`);
    }

  } catch (e) {
    errors.push({ turn: turnCount, message: `Unhandled: ${e.message}`, stack: e.stack });
  }

  return { game: gameNum, mode: 'native', success: errors.length === 0, turns: turnCount, errors };
}

// ---- Main ----
const results = [];

// Run 3 manual games
for (let i = 1; i <= 3; i++) results.push(runManualGame(i));

// Run 3 native games
for (let i = 4; i <= 6; i++) results.push(runNativeGame(i));

console.log(`\n${'='.repeat(60)}`);
console.log('SUMMARY');
console.log(`${'='.repeat(60)}`);
let allPassed = true;
for (const r of results) {
  const status = r.success ? 'PASS ✓' : 'FAIL ✗';
  console.log(`Game ${r.game} (${r.mode}): ${status} (${r.turns} turns, ${r.errors.length} errors)`);
  if (!r.success) {
    allPassed = false;
    for (const e of r.errors.slice(0, 5)) {
      console.log(`  T${e.turn}: ${e.message}`);
    }
    if (r.errors.length > 5) console.log(`  ... and ${r.errors.length - 5} more`);
  }
}
console.log(`\nOverall: ${allPassed ? 'ALL PASSED ✓' : 'SOME FAILED ✗'}`);

process.exit(allPassed ? 0 : 1);
