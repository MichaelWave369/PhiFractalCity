/* ΦFractalCity R0.1: canonical, graphics-independent world state */
export const SCHEMA = 'phifractalcity.world.v1';
export const STORAGE_KEY = 'phifractalcity:district-zero:v1';
export const MAX_DEPTH = 8;
export const MAX_MEMORIES = 250;
export const MAX_EVENTS = 120;
export const JOBS = ['explore', 'study', 'build', 'rest'];
const POCKET_RX = /^0(?:\/[0-8]){0,8}$/;

export function validateAddress(address) {
  return typeof address === 'string' && POCKET_RX.test(address);
}
export function childAddress(address, index) {
  if (!validateAddress(address) || !Number.isInteger(index) || index < 0 || index > 8 || address.split('/').length - 1 >= MAX_DEPTH) {
    throw new Error('Invalid pocket address or maximum nesting reached');
  }
  return address + '/' + index;
}
export function parentAddress(address) {
  if (!validateAddress(address)) throw new Error('Invalid pocket address');
  return address === '0' ? '0' : address.slice(0, address.lastIndexOf('/'));
}
export function hashString(input) {
  let h = 2166136261;
  for (const char of String(input)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Escape-time samples produce repeatable shapes; not a claim of infinite storage.
export function mandelbrotEscape(cx, cy, iterations = 24) {
  let zx = 0, zy = 0;
  for (let i = 0; i < iterations; i++) {
    const nx = zx * zx - zy * zy + cx;
    zy = 2 * zx * zy + cy;
    zx = nx;
    if (zx * zx + zy * zy > 4) return i;
  }
  return iterations;
}
export function generateDistrict(address, seed = 369) {
  if (!validateAddress(address)) throw new Error('Invalid pocket');
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('Invalid seed');
  const depth = address.split('/').length - 1;
  const random = seededRandom(hashString(seed + ':' + address));
  const buildings = [];
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (gx === 0 || gz === 0) continue;
      const cx = (gx / 9) * 2.6 - 0.71 + depth * .0003;
      const cy = (gz / 9) * 2.4 + .22;
      const escape = mandelbrotEscape(cx, cy);
      const height = 2 + Math.min(10, escape / 2) + random() * 2;
      buildings.push({
        id: gx + ',' + gz,
        x: gx * 5, z: gz * 5,
        height: Math.round(height * 10) / 10,
        style: Math.floor(random() * 4)
      });
    }
  }
  return {
    address, depth,
    name: depth === 0 ? 'District Zero' : 'Pocket ' + address.split('/').slice(1).join(' · '),
    buildings,
    portals: Array.from({ length: 9 }, (_, index) => ({
      index, address: depth < MAX_DEPTH ? childAddress(address, index) : null
    }))
  };
}
export function makeWorld(seed = 369) {
  const createdAt = new Date().toISOString();
  return {
    schema: SCHEMA, seed, address: '0', createdAt, memorySequence: 0,
    memories: [],
    events: [{ id: 'e0', time: createdAt, type: 'system', address: '0', text: 'District Zero established. Welcome to the living city.' }],
    agents: [{ id: 'ori-001', name: 'Ori', home: '0', address: '0',
      role: 'Resident prototype', activity: 'study', tick: 0, enabled: false }]
  };
}
export function appendEvent(world, type, text, address = world.address) {
  if (!validateAddress(address)) throw new Error('Invalid event address');
  world.events.push({
    id: 'e' + Date.now() + '-' + world.events.length, time: new Date().toISOString(),
    type: String(type).slice(0, 40), address, text: String(text).slice(0, 250)
  });
  if (world.events.length > MAX_EVENTS) world.events.splice(0, world.events.length - MAX_EVENTS);
  return world;
}
export function addMemory(world, text, { address = world.address, author = 'visitor', kind = 'note' } = {}) {
  if (!validateAddress(address)) throw new Error('Invalid memory location');
  if (typeof text !== 'string' || !text.trim() || text.length > 500) throw new Error('Memory must contain 1–500 characters');
  if (!['visitor', 'ori-001'].includes(author)) throw new Error('Unrecognized memory author');
  if (!['note', 'marker', 'simulation'].includes(kind)) throw new Error('Unrecognized memory type');
  world.memorySequence += 1;
  const memory = {
    id: 'm' + world.memorySequence, address, author, kind,
    text: text.trim(), time: new Date().toISOString()
  };
  world.memories.push(memory);
  if (world.memories.length > MAX_MEMORIES) world.memories.splice(0, world.memories.length - MAX_MEMORIES);
  appendEvent(world, 'memory', (author === 'visitor' ? 'Visitor' : 'Ori') + ' recorded: ' + memory.text, address);
  return memory;
}
export function setAgentJob(world, job) {
  if (!JOBS.includes(job)) throw new Error('Unsupported activity');
  const agent = world.agents[0];
  agent.activity = job;
  agent.enabled = true;
  agent.address = world.address;
  appendEvent(world, 'agent', agent.name + ' began ' + job + ' in ' + world.address + '.');
  return agent;
}
export function agentStep(world) {
  const agent = world.agents[0];
  if (!agent.enabled) return null;
  agent.tick++;
  const descriptions = {
    explore: ['mapped a neighboring pocket boundary', 'charted three recursive routes', 'marked an observation point'],
    study: ['compared two geometric structures', 'indexed a local memory reference', 'studied a fractal boundary'],
    build: ['sketched a public workshop blueprint', 'arranged a geometric sculpture', 'updated a district proposal'],
    rest: ['visited the Commons garden', 'paused at the observation deck', 'watched the district skyline']
  };
  const detail = descriptions[agent.activity][(agent.tick - 1) % 3];
  const note = 'Ori ' + detail + '.';
  addMemory(world, note, { address: agent.address, author: agent.id, kind: 'simulation' });
  return note;
}
export function enterPocket(world, index) {
  world.address = childAddress(world.address, index);
  appendEvent(world, 'travel', 'Visitor entered pocket ' + world.address + '.');
  return world.address;
}
export function returnPocket(world) {
  world.address = parentAddress(world.address);
  appendEvent(world, 'travel', 'Visitor returned to ' + world.address + '.');
  return world.address;
}
export function memoriesHere(world) {
  return world.memories.filter(m => m.address === world.address);
}
export function validateWorld(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'Not an object' };
  if (value.schema !== SCHEMA || !validateAddress(value.address)) return { ok: false, reason: 'Wrong schema or pocket address' };
  if (!Number.isInteger(value.seed) || value.seed < 0 || value.seed > 2147483647) return { ok: false, reason: 'Invalid seed' };
  if (!Number.isInteger(value.memorySequence) || value.memorySequence < 0 || value.memorySequence > 10000000) return { ok: false, reason: 'Invalid sequence' };
  const agents = value.agents;
  if (!Array.isArray(agents) || agents.length !== 1 || agents[0]?.id !== 'ori-001' ||
      !JOBS.includes(agents[0]?.activity) || typeof agents[0]?.enabled !== 'boolean' ||
      !validateAddress(agents[0]?.address) || !Number.isInteger(agents[0]?.tick) ||
      agents[0]?.tick < 0 || agents[0]?.tick > 10000000) return { ok: false, reason: 'Invalid agents' };
  if (!Array.isArray(value.memories) || value.memories.length > MAX_MEMORIES || value.memories.some(m =>
    !m || typeof m.id !== 'string' || m.id.length > 30 || !validateAddress(m.address) ||
    typeof m.text !== 'string' || m.text.length > 500 || !m.text.trim() ||
    !['visitor', 'ori-001'].includes(m.author) || !['note', 'marker', 'simulation'].includes(m.kind) ||
    typeof m.time !== 'string' || m.time.length > 40)) return { ok: false, reason: 'Invalid memories' };
  if (!Array.isArray(value.events) || value.events.length > MAX_EVENTS || value.events.some(e =>
    !e || typeof e.text !== 'string' || e.text.length > 250 || !validateAddress(e.address) ||
    typeof e.time !== 'string' || e.time.length > 40 || typeof e.type !== 'string' ||
    e.type.length > 40)) return { ok: false, reason: 'Invalid events' };
  return { ok: true };
}
export function serializeWorld(world) {
  const valid = validateWorld(world);
  if (!valid.ok) throw new Error(valid.reason);
  return JSON.stringify(world, null, 2);
}
export function parseWorld(input) {
  if (typeof input !== 'string' || input.length > 300000) throw new Error('Import must be a JSON document below 300 KB');
  const parsed = JSON.parse(input);
  const valid = validateWorld(parsed);
  if (!valid.ok) throw new Error('Import rejected: ' + valid.reason);
  return parsed;
}
export function loadWorld(storage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return saved ? parseWorld(saved) : makeWorld();
  } catch {
    return makeWorld();
  }
}
export function saveWorld(world, storage) {
  try {
    storage?.setItem(STORAGE_KEY, serializeWorld(world));
    return true;
  } catch {
    return false;
  }
}
