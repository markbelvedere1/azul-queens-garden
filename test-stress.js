const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
let jsCode = scriptMatch[1];

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
  code = code.replace(/document\.getElementById\('[^']+'\)\.addEventListener[\s\S]*?}\);/g, '');
  code = code.replace(/\/\/ === INIT ===\s*\ninitGame\(\);/, '');
  code = code.replace(/setTimeout\(function\(\)\s*\{\s*aiTurn\(\);\s*\},\s*\d+\);/g, 'aiTurn();');

  const w = `(function(document,setTimeout,clearTimeout,window){${code};return{State,initGame,endTurn,endRound,aiTurn,getAcquireMatches,executeAcquire,executeAcquireExpansion,canPlaceTile,placeTile,findValidExpansionCenters,confirmExpansionPlacement,placeExpansion,decideAiAction,findAiPlacement,findAiAcquire,hexNeighbors,hexKey,addLog,scoreEndOfRound,scoreFinalGroups,scoreLeftovers,renderAll,expandAiGarden,initAiGarden,countGardenSize}})`;
  const doc = createDomStubs();
  return eval(w)(doc,(fn)=>fn(),()=>{},{innerWidth:1024,innerHeight:768});
}

const GAMES = 20;
let totalErrors = 0;
let totalGames = 0;

for (let i = 0; i < GAMES; i++) {
  const g = createGame();
  const errors = [];
  let turns = 0;
  
  g.initGame();
  g.State.players[0].isHuman = false;

  while (g.State.round <= 4 && turns < 2000) {
    turns++;
    const p = g.State.currentPlayer;
    
    if (g.State.roundPassed.every(x => x)) {
      try { g.endRound(); } catch(e) { errors.push(`endRound: ${e.message}`); break; }
      if (g.State.round > 4) break;
      continue;
    }
    if (g.State.roundPassed[p]) { g.State.currentPlayer = (p+1)%4; continue; }

    if (!g.State.players[p].aiStorage) g.State.players[p].aiStorage = [];
    if (!g.State.players[p].aiExpStorage) g.State.players[p].aiExpStorage = [];
    if (!g.State.players[p].aiGarden) g.initAiGarden(p);

    const aS = p===0?g.State.storage:g.State.players[p].aiStorage;
    const aE = p===0?g.State.expansionStorage:g.State.players[p].aiExpStorage;
    const aG = p===0?g.State.garden:g.State.players[p].aiGarden;
    if(p===0){g.State.players[0].aiStorage=aS;g.State.players[0].aiExpStorage=aE;g.State.players[0].aiGarden=aG;}

    let action;
    try { action = g.decideAiAction(p, aS, aE, aG); } catch(e) {
      errors.push(`T${turns} P${p} decide: ${e.message}`);
      g.State.roundPassed[p]=true; g.State.currentPlayer=(p+1)%4; continue;
    }
    if (!action) { g.State.roundPassed[p]=true; g.State.currentPlayer=(p+1)%4; continue; }

    try {
      if (action.type==='acquire') {
        const m = g.getAcquireMatches(action.attrType, action.attrValue);
        if(m.tiles.length===0){g.State.roundPassed[p]=true;}
        else {
          let took=false;
          const st=m.tiles.filter(x=>x.source==='stack');
          const dt=m.tiles.filter(x=>x.source==='display');
          st.sort((a,b)=>b.tileIdx-a.tileIdx);
          for(const t of st){if(aS.length<12)aS.push(t.tile);if(g.State.expansionStack.length>0)g.State.expansionStack[0].tilesOnTop.splice(t.tileIdx,1);took=true;}
          const byE={};for(const t of dt){if(!byE[t.expIdx])byE[t.expIdx]=[];byE[t.expIdx].push(t);}
          for(const k of Object.keys(byE).sort((a,b)=>parseInt(b)-parseInt(a))){byE[k].sort((a,b)=>b.tileIdx-a.tileIdx);for(const t of byE[k]){if(aS.length<12)aS.push(t.tile);if(g.State.displayExpansions[parseInt(k)])g.State.displayExpansions[parseInt(k)].tilesOnTop.splice(t.tileIdx,1);}}
          if(took&&g.State.expansionStack.length>0){const mv=g.State.expansionStack.shift();g.State.displayExpansions.push(mv);if(g.State.expansionStack.length>0){const tp=g.State.expansionStack[0];for(let t=0;t<4;t++){if(g.State.bag.length)tp.tilesOnTop.push(g.State.bag.pop());}}}
          for(const de of g.State.displayExpansions){if(!de.faceUp&&(!de.tilesOnTop||de.tilesOnTop.length===0))de.faceUp=true;}
        }
      } else if (action.type==='acquireExp') {
        const idx=action.expIndex;
        if(idx>=0&&idx<g.State.displayExpansions.length&&g.State.displayExpansions[idx].faceUp&&aE.length<2){aE.push(g.State.displayExpansions.splice(idx,1)[0]);}
        else g.State.roundPassed[p]=true;
      } else if (action.type==='place') {
        const tile=aS[action.tileIdx];
        if(!tile){errors.push(`T${turns} P${p} place: bad idx`);g.State.roundPassed[p]=true;}
        else{const cell=aG.get(g.hexKey(action.target.q,action.target.r));
          if(!cell||cell.tile){errors.push(`T${turns} P${p} place: bad target`);g.State.roundPassed[p]=true;}
          else{cell.tile=tile;const ri=[action.tileIdx].concat(action.paymentIdxs||[]);ri.sort((a,b)=>b-a);for(const r of ri){if(r<aS.length)aS.splice(r,1);else errors.push(`T${turns} P${p} pay OOB ${r}/${aS.length}`);}}}
      } else if (action.type==='placeExp') {
        if(aE.length===0){errors.push(`T${turns} P${p} placeExp empty`);g.State.roundPassed[p]=true;}
        else{aE.splice(0,1);try{g.expandAiGarden(p,aG);}catch(e){errors.push(`T${turns} P${p} expand: ${e.message}`);}}
      } else if (action.type==='pass') {
        g.State.roundPassed[p]=true;
      } else {
        errors.push(`T${turns} P${p} unknown action: ${action.type}`);g.State.roundPassed[p]=true;
      }
    } catch(e) { errors.push(`T${turns} P${p} ${action.type}: ${e.message}`); g.State.roundPassed[p]=true; }

    // Validate storage bounds
    if(aS.length>12)errors.push(`T${turns} P${p} storage overflow: ${aS.length}`);
    if(aE.length>2)errors.push(`T${turns} P${p} exp storage overflow: ${aE.length}`);

    let next=(p+1)%4,guard=0;
    while(g.State.roundPassed[next]&&guard<4){next=(next+1)%4;guard++;}
    if(guard>=4){try{g.endRound();}catch(e){errors.push(`endRound: ${e.message}`);break;}}
    else g.State.currentPlayer=next;
  }

  if(turns>=2000)errors.push('infinite loop');
  totalGames++;
  totalErrors+=errors.length;
  
  const scores = g.State.players.map(p=>p.score);
  const status = errors.length===0?'✓':'✗';
  console.log(`Game ${i+1}: ${status} ${turns}t scores=[${scores}] ${errors.length>0?errors.slice(0,3).join('; '):''}`);
}

console.log(`\n${totalGames} games, ${totalErrors} total errors. ${totalErrors===0?'ALL PASSED ✓':'FAILURES FOUND ✗'}`);
process.exit(totalErrors===0?0:1);
