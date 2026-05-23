// test-phase1.js — Node.js test for Phase 1 logic
const COLORS = [
  { name: 'Lavender', hex: '#B39DDB', id: 'lavender' },
  { name: 'Purple',   hex: '#7B1FA2', id: 'purple' },
  { name: 'L.Green',  hex: '#81C784', id: 'light-green' },
  { name: 'D.Green',  hex: '#2E7D32', id: 'dark-green' },
  { name: 'L.Blue',   hex: '#64B5F6', id: 'light-blue' },
  { name: 'Yellow',   hex: '#FFD54F', id: 'yellow' }
];
const PATTERNS = [
  { name: 'Tree', cost: 1, icon: '🌲', id: 'tree' },
  { name: 'Bird', cost: 2, icon: '🐦', id: 'bird' },
  { name: 'Butterfly', cost: 3, icon: '🦋', id: 'butterfly' },
  { name: 'Flower', cost: 4, icon: '🌸', id: 'flower' },
  { name: 'Grass', cost: 5, icon: '🌿', id: 'grass' },
  { name: 'Tulip', cost: 6, icon: '🌷', id: 'tulip' }
];
const HEX_DIRS = [
  {q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}
];
function hexKey(q,r){return q+','+r}
function hexNeighbors(q,r){return HEX_DIRS.map(d=>({q:q+d.q,r:r+d.r}))}
function createAllTiles(){const t=[];let id=0;for(const c of COLORS)for(const p of PATTERNS)for(let i=0;i<3;i++)t.push({id:id++,color:c.id,pattern:p.id,cost:p.cost,isJoker:false});return t}
function createJokers(){const j=[];for(let i=0;i<24;i++)j.push({id:1000+i,color:'joker',pattern:'joker',isJoker:true});return j}
function createFountainLayout(){const c=[];c.push({q:0,r:0,feature:'fountain'});for(const d of HEX_DIRS)c.push({q:d.q,r:d.r,feature:null});const r2=[{q:2,r:-1},{q:1,r:1},{q:-1,r:2},{q:-2,r:1},{q:-1,r:-1},{q:1,r:-2}];for(const x of r2)c.push({q:x.q,r:x.r,feature:null});return c}

function canPlaceTile(garden,q,r,tile){
  const cell=garden.get(hexKey(q,r));
  if(!cell)return false;
  if(cell.tile)return false;
  const nbrs=hexNeighbors(q,r);
  let hasAdj=false;
  for(const n of nbrs){
    const nc=garden.get(hexKey(n.q,n.r));
    if(!nc||!nc.tile)continue;
    hasAdj=true;
    const nt=nc.tile;
    if(nt.color===tile.color&&nt.pattern===tile.pattern)return false;
    if(tile.isJoker||nt.isJoker)continue;
    if(nt.color!==tile.color&&nt.pattern!==tile.pattern)return false;
  }
  let hasTiles=false;
  for(const[,c]of garden){if(c.tile){hasTiles=true;break}}
  if(hasTiles&&!hasAdj)return false;
  return true;
}

// === TESTS ===
let pass=0,fail=0;
function assert(cond,msg){if(cond){pass++;console.log('  ✅',msg)}else{fail++;console.log('  ❌',msg)}}

console.log('=== TILE CREATION ===');
const tiles=createAllTiles();
assert(tiles.length===108,'108 colored tiles');
assert(createJokers().length===24,'24 jokers');
assert(new Set(tiles.map(t=>t.color+':'+t.pattern)).size===36,'36 unique combos');

console.log('\n=== FOUNTAIN BOARD ===');
const fl=createFountainLayout();
assert(fl.length===13,'13 hex cells');
assert(fl[0].feature==='fountain','center is fountain');
// All positions unique
const keys=new Set(fl.map(c=>hexKey(c.q,c.r)));
assert(keys.size===13,'all positions unique');

console.log('\n=== HEX MATH ===');
assert(hexNeighbors(0,0).length===6,'6 neighbors');
// Neighbors should be distinct
const nk=new Set(hexNeighbors(0,0).map(n=>hexKey(n.q,n.r)));
assert(nk.size===6,'neighbors distinct');

console.log('\n=== ADJACENCY RULES ===');
const garden=new Map();
for(const c of fl)garden.set(hexKey(c.q,c.r),{q:c.q,r:c.r,tile:null,feature:c.feature});

const blu={color:'light-blue',pattern:'tree',isJoker:false};
const pur={color:'purple',pattern:'tree',isJoker:false};
const bluB={color:'light-blue',pattern:'bird',isJoker:false};
const purB={color:'purple',pattern:'bird',isJoker:false};
const jkr={color:'joker',pattern:'joker',isJoker:true};

assert(canPlaceTile(garden,1,0,blu),'first tile on empty garden');
garden.get(hexKey(1,0)).tile=blu;

assert(canPlaceTile(garden,0,1,bluB),'same color diff pattern OK');
assert(canPlaceTile(garden,0,1,pur),'same pattern diff color OK');
assert(!canPlaceTile(garden,0,1,{...blu}),'identical tile rejected');
assert(!canPlaceTile(garden,0,1,purB),'diff color AND pattern rejected');
assert(!canPlaceTile(garden,-1,2,pur),'non-adjacent rejected');
assert(canPlaceTile(garden,0,1,jkr),'joker always OK');

// Occupied cell
assert(!canPlaceTile(garden,1,0,pur),'occupied cell rejected');

// Off-garden
assert(!canPlaceTile(garden,5,5,blu),'off-garden rejected');

console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
process.exit(fail>0?1:0);
