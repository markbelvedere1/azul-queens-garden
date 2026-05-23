// test-phase3.js — Cost payment tests
var pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } }

// Mock tile
function tile(color, pattern, cost, isJoker) {
  return { color: color, pattern: pattern, cost: cost || 0, isJoker: !!isJoker,
    colorName: color, colorHex: '#000', patternName: pattern, patternIcon: '?' };
}

// Minimal state mock
var State = {
  storage: [],
  garden: new Map(),
  jokerPool: []
};

// Cost function
function getPaymentCost(t) { return t.isJoker ? 0 : t.cost; }

function canAffordPlacement(tileIndex) {
  var t = State.storage[tileIndex];
  if (!t) return false;
  var cost = getPaymentCost(t);
  if (cost <= 1) return true;
  var needed = cost - 1;
  var available = 0;
  for (var i = 0; i < State.storage.length; i++) {
    if (i === tileIndex) continue;
    var pt = State.storage[i];
    if (pt.isJoker) { available++; continue; }
    if (pt.color === t.color || pt.pattern === t.pattern) available++;
  }
  return available >= needed;
}

console.log('=== COST PAYMENT TESTS ===');

// Tree (cost 1) = free
State.storage = [tile('blue', 'tree', 1)];
assert(canAffordPlacement(0), 'Tree (cost 1) is free');

// Bird (cost 2) needs 1 extra
State.storage = [tile('blue', 'bird', 2), tile('blue', 'tree', 1)];
assert(canAffordPlacement(0), 'Bird with same-color payment OK');

State.storage = [tile('blue', 'bird', 2), tile('red', 'bird', 2)];
assert(canAffordPlacement(0), 'Bird with same-pattern payment OK');

State.storage = [tile('blue', 'bird', 2), tile('red', 'tree', 1)];
assert(!canAffordPlacement(0), 'Bird with no matching payment FAIL');

// Flower (cost 4) needs 3 extras
State.storage = [tile('blue', 'flower', 4), tile('blue', 'tree', 1), tile('blue', 'bird', 2), tile('blue', 'grass', 5)];
assert(canAffordPlacement(0), 'Flower with 3 same-color payment OK');

State.storage = [tile('blue', 'flower', 4), tile('blue', 'tree', 1), tile('red', 'tree', 1)];
assert(!canAffordPlacement(0), 'Flower with only 2 matching FAIL');

// Joker as payment
State.storage = [tile('blue', 'tulip', 6), tile('joker', 'joker', 0, true), tile('joker', 'joker', 0, true),
  tile('blue', 'tree', 1), tile('blue', 'bird', 2), tile('blue', 'grass', 5)];
assert(canAffordPlacement(0), 'Tulip (cost 6) with jokers + same-color OK');

// Joker placement is free
State.storage = [tile('joker', 'joker', 0, true)];
assert(canAffordPlacement(0), 'Joker is free to place');

console.log('\n=== RESULTS: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
