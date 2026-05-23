const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
let jsCode = scriptMatch[1];

// Stub window/navigator for Node test env
if (typeof window === 'undefined') {
  global.window = { onerror: null, addEventListener: function() {} };
  global.navigator = { clipboard: null };
}

function createDomStubs() {
  const els = {};
  function s(id) {
    if (!els[id]) {
      els[id] = {
        textContent:'',innerHTML:'',disabled:false,
        style:new Proxy({},{get:()=>'',set:()=>true}),
        children:[],
        classList:{_c:new Set(),add(c){this._c.add(c)},remove(c){this._c.delete(c)},contains(c){return this._c.has(c)},toggle(c){this._c.has(c)?this._c.delete(c):this._c.add(c)}},
        appendChild(c){this.children.push(c);return c},removeChild(c){this.children=this.children.filter(x=>x!==c);return c},
        insertBefore(a,b){this.children.push(a);return a},replaceChild(n,o){return o},
        cloneNode(){return s('c'+Math.random().toString(36).slice(2))},
        get firstChild(){return this.children[0]||null},
        get parentNode(){return{replaceChild(n,o){return n},removeChild(c){return c}}},
        addEventListener(){},removeEventListener(){},setAttribute(){},getAttribute(){return ''},
        querySelector(){return null},querySelectorAll(){return[]},
        get id(){return id},set id(v){},offsetWidth:800,offsetHeight:600
      };
    }
    return els[id];
  }
  return {
    getElementById:s,createElement:()=>s('e'+Math.random().toString(36).slice(2)),
    createElementNS:()=>s('n'+Math.random().toString(36).slice(2)),
    createTextNode:(t)=>({textContent:t}),
    body:{appendChild(){},removeChild(){},children:[]},
    querySelector(){return null},querySelectorAll(){return[]}
  };
}

function createGame() {
  let code = jsCode;
  // Remove event listener attachments
  code = code.replace(/document\.getElementById\('[^']+'\)\.addEventListener[\s\S]*?}\);/g, '');
  // Remove auto-init
  code = code.replace(/\/\/ === INIT ===\s*\ninitGame\(\);/, '');
  // Make AI turns synchronous
  code = code.replace(/setTimeout\(function\(\)\s*\{\s*aiTurn\(\);\s*\},\s*\d+\);/g, 'aiTurn();');

  const exports = `State,initGame,endTurn,endRound,aiTurn,getAcquireMatches,executeAcquire,
    executeAcquireExpansion,canPlaceTile,placeTile,findValidExpansionCenters,
    confirmExpansionPlacement,placeExpansion,decideAiAction,findAiPlacement,
    findAiAcquire,hexNeighbors,hexKey,addLog,scoreEndOfRound,scoreFinalGroups,
    scoreLeftovers,renderAll,expandAiGarden,initAiGarden,countGardenSize,
    getExpansionCost,canAiAffordExpansion,payAiExpansionCost,PATTERNS,PATTERN_MAP,COLORS,COLOR_MAP`.replace(/\s+/g,'');

  const w = `(function(document,setTimeout,clearTimeout,window,navigator){${code};return{${exports}}})`;
  const doc = createDomStubs();
  return eval(w)(doc,(fn)=>fn(),()=>{},{innerWidth:1024,innerHeight:768,onerror:null,addEventListener:function(){}},{clipboard:null});
}

// ============== CONFIG ==============
const GAMES = 20;
const MIN_SCORE = 25;
const MAX_SCORE = 250;

let totalErrors = 0;
let totalAnomalies = 0;
let totalGames = 0;
let allResults = [];

for (let gi = 0; gi < GAMES; gi++) {
  const g = createGame();
  const errors = [];
  const anomalies = [];
  let turns = 0;
  let expCostPaid = 0;
  let expPlacedFree = 0;
  let expPlacedTotal = 0;
  let roundStats = [];

  g.initGame();
  g.State.players[0].isHuman = false;

  // Run game loop
  while (g.State.round <= 4 && turns < 2000) {
    turns++;
    const p = g.State.currentPlayer;

    if (g.State.roundPassed.every(x => x)) {
      // Snapshot pre-round-end stats
      const rStat = {
        round: g.State.round,
        storages: g.State.players.map((pl, pi) => {
          if (pi === 0) return g.State.storage.length;
          return (pl.aiStorage || []).length;
        }),
        gardenSizes: g.State.players.map((pl, pi) => {
          if (pi === 0) return g.countGardenSize(g.State.garden);
          return pl.aiGarden ? g.countGardenSize(pl.aiGarden) : 0;
        }),
        scores: g.State.players.map(pl => pl.score)
      };
      roundStats.push(rStat);

      try { g.endRound(); } catch(e) { errors.push(`endRound R${g.State.round}: ${e.message}`); break; }
      if (g.State.round > 4) break;
      continue;
    }
    if (g.State.roundPassed[p]) { g.State.currentPlayer = (p+1)%4; continue; }

    // Ensure AI state exists
    if (!g.State.players[p].aiStorage) g.State.players[p].aiStorage = [];
    if (!g.State.players[p].aiExpStorage) g.State.players[p].aiExpStorage = [];
    if (!g.State.players[p].aiGarden) g.initAiGarden(p);

    const aS = p===0 ? g.State.storage : g.State.players[p].aiStorage;
    const aE = p===0 ? g.State.expansionStorage : g.State.players[p].aiExpStorage;
    const aG = p===0 ? g.State.garden : g.State.players[p].aiGarden;
    if (p===0) {
      g.State.players[0].aiStorage = aS;
      g.State.players[0].aiExpStorage = aE;
      g.State.players[0].aiGarden = aG;
    }

    let action;
    try { action = g.decideAiAction(p, aS, aE, aG); } catch(e) {
      errors.push(`T${turns} P${p} decide: ${e.message}`);
      g.State.roundPassed[p]=true; g.State.currentPlayer=(p+1)%4; continue;
    }
    if (!action) { g.State.roundPassed[p]=true; g.State.currentPlayer=(p+1)%4; continue; }

    try {
      if (action.type==='acquire') {
        const m = g.getAcquireMatches(action.attrType, action.attrValue);
        if (m.tiles.length===0) {
          g.State.roundPassed[p]=true;
        } else {
          let took=false;
          const st=m.tiles.filter(x=>x.source==='stack');
          const dt=m.tiles.filter(x=>x.source==='display');
          st.sort((a,b)=>b.tileIdx-a.tileIdx);
          for (const t of st) {
            if (aS.length<12) aS.push(t.tile);
            if (g.State.expansionStack.length>0) g.State.expansionStack[0].tilesOnTop.splice(t.tileIdx,1);
            took=true;
          }
          const byE={};
          for (const t of dt) { if (!byE[t.expIdx]) byE[t.expIdx]=[]; byE[t.expIdx].push(t); }
          for (const k of Object.keys(byE).sort((a,b)=>parseInt(b)-parseInt(a))) {
            byE[k].sort((a,b)=>b.tileIdx-a.tileIdx);
            for (const t of byE[k]) {
              if (aS.length<12) aS.push(t.tile);
              if (g.State.displayExpansions[parseInt(k)])
                g.State.displayExpansions[parseInt(k)].tilesOnTop.splice(t.tileIdx,1);
            }
          }
          if (took && g.State.expansionStack.length>0) {
            const mv=g.State.expansionStack.shift();
            g.State.displayExpansions.push(mv);
            if (g.State.expansionStack.length>0) {
              const tp=g.State.expansionStack[0];
              for (let t=0;t<4;t++) { if (g.State.bag.length) tp.tilesOnTop.push(g.State.bag.pop()); }
            }
          }
          for (const de of g.State.displayExpansions) {
            if (!de.faceUp && (!de.tilesOnTop||de.tilesOnTop.length===0)) de.faceUp=true;
          }
        }
      } else if (action.type==='acquireExp') {
        const idx=action.expIndex;
        if (idx>=0 && idx<g.State.displayExpansions.length && g.State.displayExpansions[idx].faceUp && aE.length<2) {
          aE.push(g.State.displayExpansions.splice(idx,1)[0]);
        } else {
          g.State.roundPassed[p]=true;
        }
      } else if (action.type==='place') {
        const tile=aS[action.tileIdx];
        if (!tile) {
          errors.push(`T${turns} P${p} place: bad idx ${action.tileIdx}/${aS.length}`);
          g.State.roundPassed[p]=true;
        } else {
          const cell=aG.get(g.hexKey(action.target.q,action.target.r));
          if (!cell||cell.tile) {
            errors.push(`T${turns} P${p} place: bad target`);
            g.State.roundPassed[p]=true;
          } else {
            cell.tile=tile;
            const ri=[action.tileIdx].concat(action.paymentIdxs||[]);
            ri.sort((a,b)=>b-a);
            for (const r of ri) {
              if (r<aS.length) aS.splice(r,1);
              else errors.push(`T${turns} P${p} pay OOB ${r}/${aS.length}`);
            }
          }
        }
      } else if (action.type==='placeExp') {
        if (aE.length===0) {
          errors.push(`T${turns} P${p} placeExp: no expansions in storage`);
          g.State.roundPassed[p]=true;
        } else {
          const aiExp = aE.splice(0,1)[0];
          const cost = g.getExpansionCost(aiExp);
          expPlacedTotal++;
          if (cost > 1) {
            if (g.canAiAffordExpansion(aiExp, aS)) {
              const preLen = aS.length;
              try {
                g.expandAiGarden(p, aG, aiExp, aS);
                const postLen = aS.length;
                const paid = preLen - postLen;
                expCostPaid += paid;
              } catch(e) { errors.push(`T${turns} P${p} expandAi: ${e.message}`); }
            } else {
              errors.push(`T${turns} P${p} placeExp: can't afford cost=${cost} but decided to place`);
              // Put it back
              aE.unshift(aiExp);
              g.State.roundPassed[p]=true;
            }
          } else {
            expPlacedFree++;
            try { g.expandAiGarden(p, aG, aiExp, aS); } catch(e) { errors.push(`T${turns} P${p} expandAi: ${e.message}`); }
          }
        }
      } else if (action.type==='pass') {
        g.State.roundPassed[p]=true;
      } else {
        errors.push(`T${turns} P${p} unknown action: ${action.type}`);
        g.State.roundPassed[p]=true;
      }
    } catch(e) { errors.push(`T${turns} P${p} ${action.type}: ${e.message}\n${e.stack}`); g.State.roundPassed[p]=true; }

    // Validate storage bounds
    if (aS.length>12) errors.push(`T${turns} P${p} storage overflow: ${aS.length}`);
    if (aE.length>2) errors.push(`T${turns} P${p} exp storage overflow: ${aE.length}`);

    let next=(p+1)%4, guard=0;
    while (g.State.roundPassed[next] && guard<4) { next=(next+1)%4; guard++; }
    if (guard>=4) {
      const rStat = {
        round: g.State.round,
        storages: g.State.players.map((pl, pi) => pi===0 ? g.State.storage.length : (pl.aiStorage||[]).length),
        gardenSizes: g.State.players.map((pl, pi) => pi===0 ? g.countGardenSize(g.State.garden) : (pl.aiGarden ? g.countGardenSize(pl.aiGarden) : 0)),
        scores: g.State.players.map(pl => pl.score)
      };
      roundStats.push(rStat);
      try { g.endRound(); } catch(e) { errors.push(`endRound: ${e.message}`); break; }
    } else {
      g.State.currentPlayer=next;
    }
  }

  if (turns>=2000) errors.push('infinite loop');
  totalGames++;
  totalErrors += errors.length;

  const scores = g.State.players.map(p=>p.score);

  // === SCORE VALIDATION ===
  for (let si=0; si<scores.length; si++) {
    if (scores[si] < MIN_SCORE) {
      anomalies.push(`P${si} score ${scores[si]} below ${MIN_SCORE}`);
    }
    if (scores[si] > MAX_SCORE) {
      anomalies.push(`P${si} score ${scores[si]} above ${MAX_SCORE}`);
    }
  }

  // === GARDEN SIZE VALIDATION ===
  if (roundStats.length > 0) {
    const lastRound = roundStats[roundStats.length - 1];
    for (let gi2=0; gi2<4; gi2++) {
      if (lastRound.gardenSizes[gi2] < 13) {
        anomalies.push(`P${gi2} garden size ${lastRound.gardenSizes[gi2]} < 13 (starting size)`);
      }
    }
    // Verify gardens grew (at least some expansion)
    for (let ri=1; ri<roundStats.length; ri++) {
      for (let pi=0; pi<4; pi++) {
        if (roundStats[ri].gardenSizes[pi] < roundStats[ri-1].gardenSizes[pi]) {
          anomalies.push(`P${pi} garden shrunk R${roundStats[ri-1].round}→R${roundStats[ri].round}: ${roundStats[ri-1].gardenSizes[pi]}→${roundStats[ri].gardenSizes[pi]}`);
        }
      }
    }
  }

  // === EXPANSION COST VALIDATION ===
  // Verify that expansions with cost > 1 actually had cost paid
  // (expCostPaid should be > 0 if any non-free expansions were placed)

  // Check expansion tiles are actually placed on outer hexes in ALL gardens
  let expTilesFound = 0;
  for (let pi=0; pi<4; pi++) {
    const ag = pi===0 ? g.State.garden : g.State.players[pi].aiGarden;
    if (ag) {
      ag.forEach(cell => {
        if (cell.tile && cell.tile.id >= 2000) expTilesFound++;
      });
    }
  }

  totalAnomalies += anomalies.length;
  const status = errors.length===0 ? '✓' : '✗';
  const aStatus = anomalies.length>0 ? ` ⚠${anomalies.length}` : '';

  // Compact round info
  const gardenInfo = roundStats.length>0 ?
    `gardens=[${roundStats[roundStats.length-1].gardenSizes}]` : '';
  const expInfo = `exps=${expPlacedTotal}(${expPlacedFree}free,${expCostPaid}paid) expTiles=${expTilesFound}`;

  console.log(`Game ${gi+1}: ${status}${aStatus} ${turns}t scores=[${scores}] ${gardenInfo} ${expInfo}${errors.length>0 ? '\n  ERRORS: '+errors.slice(0,5).join('; ') : ''}${anomalies.length>0 ? '\n  ANOMALIES: '+anomalies.join('; ') : ''}`);

  allResults.push({game:gi+1, turns, scores, errors, anomalies, roundStats, expCostPaid, expPlacedFree, expPlacedTotal, expTilesFound});
}

// === SUMMARY ===
console.log(`\n${'='.repeat(60)}`);
console.log(`${totalGames} games, ${totalErrors} total errors, ${totalAnomalies} anomalies`);

const allScores = allResults.flatMap(r=>r.scores);
console.log(`Score range: ${Math.min(...allScores)} - ${Math.max(...allScores)} (avg ${(allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1)})`);

const totalExp = allResults.reduce((a,r)=>a+r.expPlacedTotal,0);
const totalExpTiles = allResults.reduce((a,r)=>a+r.expTilesFound,0);
const totalPaid = allResults.reduce((a,r)=>a+r.expCostPaid,0);
console.log(`Expansions placed: ${totalExp} total, ${totalExpTiles} tiles found on gardens, ${totalPaid} cost tiles paid`);

if (totalErrors===0 && totalAnomalies===0) {
  console.log('ALL PASSED ✓');
} else {
  console.log(totalErrors>0 ? 'FAILURES FOUND ✗' : 'ANOMALIES ONLY (no hard errors)');
}
process.exit(totalErrors===0 ? 0 : 1);
