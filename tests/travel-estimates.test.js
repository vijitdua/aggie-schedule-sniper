const test = require('node:test');
const assert = require('node:assert/strict');
const travel = require('../shared/travel-estimates');
const buildings = require('../shared/campus-buildings');

test('resolves campus building names, aliases and room suffixes', () => {
  assert.equal(travel.resolve('Wellman Hall 106').name, 'Wellman Hall');
  assert.equal(travel.resolve('wellman room 106').name, 'Wellman Hall');
  assert.equal(travel.resolve('TLC 1010').name, 'Teaching and Learning Complex');
  assert.equal(travel.resolve('Sciences Lecture Hall 123').name, 'Khaira Lecture Hall');
  assert.equal(travel.resolve('Rock Hall 194').name, 'Peter A. Rock Hall');
  assert.equal(travel.resolve('Chemistry 194').name, 'Chemistry');
});

test('unmapped, online and ambiguous locations never receive fabricated estimates', () => {
  for (const location of ['TBA', 'Online', 'Remote', 'Unknown Hall 101', '']) {
    assert.equal(travel.estimate({ location }, { location: 'Wellman Hall 106' }), null);
  }
});

test('same-building transfers include room-change time, with room number ignored', () => {
  const result = travel.estimate({ location: 'Wellman Hall 106' }, { location: 'Wellman Hall 2' });
  assert.equal(result.sameBuilding, true);
  assert.equal(result.walking, 2);
  assert.equal(result.cycling, 2);
});

test('campus distance estimates include different mode speeds and buffers', () => {
  const from = { building: 'Wellman Hall', location: 'Wellman Hall 106' };
  const to = { building: 'Giedt Hall', location: 'Giedt Hall 1001' };
  const result = travel.estimate(from, to);
  assert.equal(result.walking, 11);
  assert.equal(result.cycling, 8);
  const reverse = travel.estimate(to, from);
  assert.equal(reverse.walking, result.walking);
  assert.equal(reverse.cycling, result.cycling);
});

test('bundled snapshot contains finite campus coordinates and recognizable teaching buildings', () => {
  for (const building of buildings) {
    assert.ok(building.lat > 38.50 && building.lat < 38.58);
    assert.ok(building.lon > -121.85 && building.lon < -121.70);
  }
  for (const name of ['California Hall', 'Olson Hall', 'Kleiber Hall', 'Hunt Hall', 'Young Hall', 'Bainer Hall']) {
    assert.ok(travel.resolve(name), name);
  }
});

test('matches building keywords despite middle initials, word order and padded room numbers', () => {
  for (const location of ['Max Kleiber Hall 00003', 'Max B. Kleiber Hall 00003',
    'Kleiber Max Hall room 00003', 'Kleiber lecture hall 00003']) {
    assert.equal(travel.resolve(location).name, 'Kleiber Hall', location);
  }
  const estimate = travel.estimate({ location: 'Max Kleiber Hall 00003' }, { location: 'Wellman Hall 00006' });
  assert.ok(estimate.walking > 0);
  assert.ok(estimate.cycling > 0);
});

test('accepts a minor typo in a distinctive keyword without guessing generic or ambiguous names', () => {
  assert.equal(travel.resolve('Kleber Hall 00003').name, 'Kleiber Hall');
  for (const location of ['Hall 3', 'Kleiber Annex 3', 'Chemistry Auditorium 3', 'Unknown Hall 101']) {
    assert.equal(travel.resolve(location), null, location);
  }
  assert.equal(travel.resolve('Chemistry 194').name, 'Chemistry');
  assert.equal(travel.resolve('Rock Hall 194').name, 'Peter A. Rock Hall');
});

test('cleaned building snapshot has one record per building and no unusable labels', () => {
  const names = buildings.map(building => building.name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim());
  assert.equal(new Set(names).size, buildings.length);
  assert.ok(buildings.length < 1000);
  for (const building of buildings) {
    assert.equal(building.name, building.name.trim());
    assert.ok(building.name.length > 0 && !building.name.includes('*'));
    assert.ok(building.aliases.every(alias => alias.trim() && alias === alias.trim() && !alias.includes('*')));
    assert.equal(new Set(building.aliases).size, building.aliases.length);
  }
  assert.equal(buildings.filter(building => building.name === 'Social Sciences & Humanities').length, 1);
  assert.equal(travel.resolve('SSH 1100').name, 'Social Sciences & Humanities');
});

test('cleanup preserves separately numbered teaching buildings and removes utility records', () => {
  const first = travel.resolve('Animal Sciences Teaching Facility 1');
  const second = travel.resolve('Animal Sciences Teaching Facility 2');
  assert.ok(first && second);
  assert.notEqual(first, second);
  assert.notEqual(first.lon, second.lon);
  assert.ok(travel.resolve('Temporary Classroom'));
  assert.equal(travel.resolve('Storage Unit 1'), null);
  assert.equal(travel.resolve('Sewer Lift Station 1'), null);
});

test('transfer assessment distinguishes comfortable, tight and impossible classroom changes', () => {
  const from = { location: 'Wellman Hall 1' };
  const to = { location: 'Katherine Esau Science Hall 1059' };
  const times = travel.estimate(from, to);
  const comfortable = travel.assessTransfer(from, to, Math.max(times.walking, times.cycling) + 3);
  assert.equal(comfortable.isTight, false);
  assert.equal(comfortable.status, 'doable');
  const tight = travel.assessTransfer(from, to, times.walking + 2);
  assert.equal(tight.isTight, true);
  assert.equal(tight.status, 'tight on foot');
  const impossible = travel.assessTransfer(from, to, 0);
  assert.equal(impossible.status, 'not enough time');
  assert.equal(impossible.tone, 'short');
  assert.equal(travel.assessTransfer(from, { location: 'TBA' }, 10), null);
  assert.equal(travel.assessTransfer(from, { location: 'Wellman Hall 6' }, 10).isTight, false);
});
