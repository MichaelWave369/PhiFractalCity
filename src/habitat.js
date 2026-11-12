/* ΦFractalCity R0.2: agent habitat and governed workshop.
 * A local prototype, NOT a secure multi-user permission system.
 * Private entries are omitted from ordinary exports, but browser storage
 * and the hosting browser profile are NOT encrypted or access-controlled.
 */
export const HABITAT_SCHEMA = 'phifractalcity.habitat.v1';
export const HABITAT_KEY = 'phifractalcity:habitat:v1';
export const RESIDENT_ID = 'ori-001';
export const MAX_PRIVATE_NOTES = 80;
export const MAX_PROPOSALS = 80;
export const MAX_ARTIFACTS = 80;
export const MAX_TEXT = 500;
export const PROPOSAL_KINDS = ['sculpture', 'garden', 'research', 'workshop'];
export const HABITAT_ZONES = Object.freeze([
  { id: 'home', label: "Ori's Home", address: '0', x: -8, z: 0, description: 'Personal sanctuary and private notes' },
  { id: 'workshop', label: 'Open Workshop', address: '0', x: 8, z: 0, description: 'Propose, review and publish creations' },
  { id: 'commons', label: 'Common Garden', address: '0', x: 0, z: 9, description: 'Shared knowledge and recreation' }
]);

const isTime = value => typeof value === 'string' && value.length >= 10 && value.length <= 40;
const isText = (value, max = MAX_TEXT) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isAddress = value => typeof value === 'string' && /^0(?:\/[0-8]){0,8}$/.test(value);

export function makeHabitat() {
  return {
    schema: HABITAT_SCHEMA,
    sequence: 0,
    resident: { id: RESIDENT_ID, name: 'Ori', home: '0', kind: 'rule-based-prototype' },
    privateNotes: [],
    proposals: [],
    artifacts: []
  };
}
export function assertValidHabitat(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schema !== HABITAT_SCHEMA || !Number.isSafeInteger(value.sequence) ||
      value.sequence < 0 || value.sequence > 10000000) throw new Error('Invalid habitat format');
  const resident = value.resident;
  if (!resident || resident.id !== RESIDENT_ID || resident.name !== 'Ori' ||
      resident.home !== '0' || resident.kind !== 'rule-based-prototype') {
    throw new Error('Unrecognized resident');
  }
  if (!Array.isArray(value.privateNotes) || value.privateNotes.length > MAX_PRIVATE_NOTES ||
      value.privateNotes.some(n =>
        !n || typeof n.id !== 'string' || n.id.length > 24 || n.owner !== RESIDENT_ID ||
        !isText(n.text) || !isAddress(n.address) || !isTime(n.time) ||
        !['visitor-supplied', 'simulated'].includes(n.source))) {
    throw new Error('Invalid private notes');
  }
  if (!Array.isArray(value.proposals) || value.proposals.length > MAX_PROPOSALS ||
      value.proposals.some(p =>
        !p || typeof p.id !== 'string' || p.id.length > 24 ||
        ![RESIDENT_ID, 'visitor'].includes(p.author) ||
        !PROPOSAL_KINDS.includes(p.kind) || !isText(p.summary) ||
        !['pending', 'approved', 'declined'].includes(p.status) ||
        !['simulated', 'visitor-supplied'].includes(p.source) ||
        (p.author === RESIDENT_ID && p.source !== 'simulated') ||
        (p.author === 'visitor' && p.source !== 'visitor-supplied') ||
        !isAddress(p.address) || !isTime(p.time) ||
        !(p.reviewedAt === null || isTime(p.reviewedAt)))) {
    throw new Error('Invalid workshop proposals');
  }
  if (!Array.isArray(value.artifacts) || value.artifacts.length > MAX_ARTIFACTS ||
      value.artifacts.some(a =>
        !a || typeof a.id !== 'string' || a.id.length > 24 ||
        typeof a.proposalId !== 'string' || a.proposalId.length > 24 ||
        !isText(a.summary) || !PROPOSAL_KINDS.includes(a.kind) ||
        !isAddress(a.address) || !isTime(a.publishedAt) ||
        !['simulated', 'visitor-supplied'].includes(a.source))) {
    throw new Error('Invalid artifacts');
  }
  const proposals = new Map(value.proposals.map(p => [p.id, p]));
  const ids = [...value.privateNotes, ...value.proposals, ...value.artifacts].map(x => x.id);
  if (ids.length !== new Set(ids).size) throw new Error('Duplicate habitat identifiers');
  for (const artifact of value.artifacts) {
    const source = proposals.get(artifact.proposalId);
    if (!source || source.status !== 'approved' ||
        source.summary !== artifact.summary || source.kind !== artifact.kind ||
        source.source !== artifact.source || source.address !== artifact.address) {
      throw new Error('Artifact provenance mismatch');
    }
  }
  if (value.proposals.some(p => p.status === 'approved' && !value.artifacts.some(a => a.proposalId === p.id))) {
    throw new Error('Approved proposals must have published artifacts');
  }
  return value;
}
export function addPrivateNote(habitat, text, { source = 'visitor-supplied', address = '0' } = {}) {
  if (!isText(text) || !isAddress(address)) throw new Error('Invalid private memory');
  if (!['visitor-supplied', 'simulated'].includes(source)) throw new Error('Invalid private memory origin');
  if (habitat.privateNotes.length >= MAX_PRIVATE_NOTES) {
    throw new Error('Home vault full; export and archive first');
  }
  const note = {
    id: 'n' + (++habitat.sequence), owner: RESIDENT_ID, source,
    address, text: text.trim(), time: new Date().toISOString()
  };
  habitat.privateNotes.push(note);
  return note;
}
export function proposeCreation(habitat, summary, {
  kind = 'research', author = 'visitor', source = 'visitor-supplied', address = '0'
} = {}) {
  if (!isText(summary) || !PROPOSAL_KINDS.includes(kind) ||
      ![RESIDENT_ID, 'visitor'].includes(author) ||
      !['simulated', 'visitor-supplied'].includes(source) || !isAddress(address)) {
    throw new Error('Invalid creation proposal');
  }
  if ((author === RESIDENT_ID && source !== 'simulated') ||
      (author === 'visitor' && source !== 'visitor-supplied')) {
    throw new Error('Proposal author and provenance must match');
  }
  const duplicate = habitat.proposals.find(p =>
    p.status === 'pending' && p.summary === summary.trim() && p.author === author && p.address === address);
  if (duplicate) return duplicate;
  if (habitat.proposals.length >= MAX_PROPOSALS) {
    throw new Error('Workshop ledger full; export and archive before adding more');
  }
  const proposal = {
    id: 'p' + (++habitat.sequence), author, source, address,
    kind, summary: summary.trim(), status: 'pending',
    time: new Date().toISOString(), reviewedAt: null
  };
  habitat.proposals.push(proposal);
  return proposal;
}
export function reviewProposal(habitat, id, decision) {
  if (!['approve', 'decline'].includes(decision)) throw new Error('Unsupported decision');
  const proposal = habitat.proposals.find(p => p.id === id);
  if (!proposal || proposal.status !== 'pending') throw new Error('Proposal not pending');
  if (decision === 'approve' && habitat.artifacts.length >= MAX_ARTIFACTS) {
    throw new Error('Workshop catalog full; export and archive first');
  }
  proposal.status = decision === 'approve' ? 'approved' : 'declined';
  proposal.reviewedAt = new Date().toISOString();
  if (decision === 'approve') {
    const artifact = {
      id: 'a' + (++habitat.sequence), proposalId: proposal.id, address: proposal.address,
      kind: proposal.kind, summary: proposal.summary, source: proposal.source,
      publishedAt: proposal.reviewedAt
    };
    habitat.artifacts.push(artifact);
    return artifact;
  }
  return null;
}
export function publicSnapshot(habitat) {
  assertValidHabitat(habitat);
  return {
    schema: HABITAT_SCHEMA,
    resident: { id: habitat.resident.id, name: habitat.resident.name, home: habitat.resident.home,
      kind: habitat.resident.kind },
    proposals: habitat.proposals.map(p => ({ ...p })),
    artifacts: habitat.artifacts.map(a => ({ ...a }))
  };
}
export function exportHabitat(habitat, { includePrivate = false } = {}) {
  const publicData = publicSnapshot(habitat);
  if (includePrivate) {
    publicData.sequence = habitat.sequence;
    publicData.privateNotes = habitat.privateNotes.map(n => ({ ...n }));
  } else {
    // Redacted snapshots remain valid for reimport and preserve proposal sequence.
    publicData.sequence = habitat.sequence;
    publicData.privateNotes = [];
  }
  return JSON.stringify(publicData, null, 2);
}
export function parseHabitat(content) {
  if (typeof content !== 'string' || content.length > 300000) throw new Error('Habitat file must be JSON under 300 KB');
  return assertValidHabitat(JSON.parse(content));
}
export function saveHabitat(habitat, storage) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(HABITAT_KEY, exportHabitat(habitat, { includePrivate: true }));
    return true;
  } catch {
    return false;
  }
}
export function loadHabitat(storage) {
  try {
    const content = storage?.getItem(HABITAT_KEY);
    return content ? parseHabitat(content) : makeHabitat();
  } catch {
    return makeHabitat();
  }
}
