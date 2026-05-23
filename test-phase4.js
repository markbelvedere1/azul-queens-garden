// test-phase4.js — Scoring tests
var pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } }

var HEX_DIRS = [{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
function hexKey(q,r){return q+','+r}
function hexNeighbors(q,r){return HEX_DIRS.map(function(d){return{q:q+d.q,r:r+d.r}})}
function shuffle(a){return a.slice()}

function tile(color, pattern) {
  return { color: color, pattern: pattern, isJoker: false };
}

// Test countMatchingHexes
function countMatchingHexes(garden, attr) {
  var count = 0;
  garden.forEach(function(cell) {
    if (!cell.tile) return;
    if (attr.type === 'color' && cell.tile.color === attr.id) count++;
    if (attr.type === 'pattern' && cell.tile.pattern === attr.id) count++;
  });
  return count;
}

function findConnectedGroups(garden, attrType) {
  var visited = new Set();
  var groups = [];
  garden.forEach(function(cell, key) {
    if (!cell.tile || cell.tile.isJoker || visited.has(key)) return;
    var attrValue = cell.tile[attrType];
    var group = [];
    var queue = [key];
    var groupVisited = new Set([key]);
    while (queue.length > 0) {
      var current = queue.shift();
      var parts = current.split(',');
      var cq = parseInt(parts[0]);
      var cr = parseInt(parts[1]);
      var currentCell = garden.get(current);
      if (currentCell && currentCell.tile && !currentCell.tile.isJoker && currentCell.tile[attrType] === attrValue) {
        group.push(currentCell.tile);
        visited.add(current);
        var nbrs = hexNeighbors(cq, cr);
        for (var i = 0; i < nbrs.length; i++) {
          var nk = hexKey(nbrs[i].q, nbrs[i].r);
          if (!groupVisited.has(nk)) { groupVisited.add(nk); queue.push(nk); }
        }
      }
    }
    if (group.length > 0) groups.push({ attribute: attrValue, size: group.length, tiles: group });
  });
  return groups;
}

function scoreLeftovers(storage, expansionStorage) {
  return -storage.length - expansionStorage.length * 3;
}

console.log('=== SCORING TESTS ===');

// Test counting
var g = new Map();
g.set('0,0', { tile: tile('blue', 'tree'), feature: null });
g.set('1,0', { tile: tile('blue', 'bird'), feature: null });
g.set('0,1', { tile: tile('red', 'tree'), feature: null });
g.set('1,1', { tile: null, feature: 'pavilion' });

assert(countMatchingHexes(g, {type:'color',id:'blue'}) === 2, 'Count 2 blue tiles');
assert(countMatchingHexes(g, {type:'pattern',id:'tree'}) === 2, 'Count 2 tree tiles');
assert(countMatchingHexes(g, {type:'color',id:'green'}) === 0, 'Count 0 green tiles');

// Test connected groups
console.log('\n=== GROUP SCORING ===');
var g2 = new Map();
g2.set('0,0', { tile: tile('blue', 'tree'), feature: null });
g2.set('1,0', { tile: tile('blue', 'bird'), feature: null });
g2.set('0,1', { tile: tile('blue', 'flower'), feature: null });
g2.set('-1,0', { tile: tile('red', 'tree'), feature: null });

var colorGroups = findConnectedGroups(g2, 'color');
var blueGroup = colorGroups.find(function(g) { return g.attribute === 'blue'; });
assert(blueGroup && blueGroup.size === 3, 'Blue color group of 3');
var redGroup = colorGroups.find(function(g) { return g.attribute === 'red'; });
assert(redGroup && redGroup.size === 1, 'Red color group of 1 (no bonus)');

// Test leftover penalties
console.log('\n=== LEFTOVER PENALTIES ===');
assert(scoreLeftovers([1,2,3], [{},{}]) === -9, '3 tiles + 2 expansions = -9');
assert(scoreLeftovers([], []) === 0, 'No leftovers = 0 penalty');
assert(scoreLeftovers([1], []) === -1, '1 tile = -1');

console.log('\n=== RESULTS: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
