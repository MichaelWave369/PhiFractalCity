import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HABITAT_KEY, HABITAT_ZONES, makeHabitat, assertValidHabitat, addPrivateNote,
  proposeCreation, reviewProposal, publicSnapshot, exportHabitat,
  parseHabitat, saveHabitat, loadHabitat
} from '../src/habitat.js';

test('resident home and three visitable zones are stable', () => {
  const h = makeHabitat();
  assert.equal(h.resident.id, 'ori-001');
  assert.equal(h.resident.home, '0');
  assert.deepEqual(HABITAT_ZONES.map(z => z.id), ['home', 'workshop', 'commons']);
  assert.equal(assertValidHabitat(h), h);
});
test('private memory stays out of default portable public snapshot', () => {
  const h = makeHabitat();
  addPrivateNote(h, 'My unshared observation: left door opens inward.', { source: 'simulated' });
  const redacted = exportHabitat(h);
  assert.ok(!redacted.includes('left door'));
  assert.equal(publicSnapshot(h).privateNotes, undefined);
  assert.equal(parseHabitat(redacted).privateNotes.length, 0);
  const full = parseHabitat(exportHabitat(h, { includePrivate: true }));
  assert.equal(full.privateNotes[0].text, 'My unshared observation: left door opens inward.');
});
test('proposals require explicit review to become a published artifact', () => {
  const h = makeHabitat();
  const proposal = proposeCreation(h, 'Construct an accessible reading garden.', { kind: 'garden' });
  assert.equal(h.artifacts.length, 0);
  assert.equal(proposal.status, 'pending');
  const artifact = reviewProposal(h, proposal.id, 'approve');
  assert.equal(artifact.summary, proposal.summary);
  assert.equal(artifact.source, 'visitor-supplied');
  assert.equal(proposal.status, 'approved');
  assert.throws(() => reviewProposal(h, proposal.id, 'approve'));
  assert.equal(parseHabitat(exportHabitat(h)).artifacts[0].proposalId, proposal.id);
});
test('declined work cannot create an artifact', () => {
  const h = makeHabitat();
  const proposal = proposeCreation(h, 'A sculptural neighborhood.', { kind: 'sculpture' });
  assert.equal(reviewProposal(h, proposal.id, 'decline'), null);
  assert.equal(h.artifacts.length, 0);
  assert.equal(proposal.status, 'declined');
});
test('simulated agent proposals have honest provenance', () => {
  const h = makeHabitat();
  assert.throws(() => proposeCreation(h, 'This is real AI work', { author: 'ori-001', source: 'visitor-supplied' }));
  const p = proposeCreation(h, 'Ori sketched a model garden.', { kind: 'garden', author: 'ori-001', source: 'simulated' });
  const same = proposeCreation(h, p.summary, { kind: 'garden', author: 'ori-001', source: 'simulated' });
  assert.equal(same.id, p.id);
  assert.equal(reviewProposal(h, p.id, 'approve').source, 'simulated');
});
test('tampered habitat and invalid origin are rejected', () => {
  const h = makeHabitat();
  addPrivateNote(h, 'Safe note');
  assert.throws(() => addPrivateNote(h, 'fake note', { source: 'unknown' }));
  assert.throws(() => addPrivateNote(h, 'x'.repeat(501)));
  const p = proposeCreation(h, 'Research the shape of a curve.', { kind: 'research' });
  reviewProposal(h, p.id, 'approve');
  const tampered = JSON.parse(exportHabitat(h));
  tampered.proposals[0].status = 'declined';
  assert.throws(() => parseHabitat(JSON.stringify(tampered)), /provenance/);
  assert.throws(() => parseHabitat('{bad'));
  assert.throws(() => parseHabitat('x'.repeat(300001)));
});
test('local persistence supports private notes without automatically exporting them', () => {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) || null,
    setItem: (key, value) => data.set(key, value)
  };
  const h = makeHabitat();
  addPrivateNote(h, 'Saved locally, not in public export.');
  assert.equal(saveHabitat(h, storage), true);
  assert.ok(data.get(HABITAT_KEY).includes('Saved locally'));
  assert.equal(loadHabitat(storage).privateNotes[0].text, 'Saved locally, not in public export.');
  assert.equal(saveHabitat(h, null), false);
  assert.equal(saveHabitat(h, { setItem() { throw Error('blocked'); } }), false);
});
test('redacted and full exports share proposal IDs and preserve source labels', () => {
  const h = makeHabitat();
  proposeCreation(h, 'Design a fractal workstation.', { kind: 'workshop' });
  addPrivateNote(h, 'Home-only memo', { source: 'simulated' });
  const publicCopy = parseHabitat(exportHabitat(h));
  const fullCopy = parseHabitat(exportHabitat(h, { includePrivate: true }));
  assert.equal(publicCopy.proposals[0].id, fullCopy.proposals[0].id);
  assert.equal(publicCopy.privateNotes.length, 0);
  assert.equal(fullCopy.privateNotes.length, 1);
});
