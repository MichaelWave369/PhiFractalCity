/* ΦFractalCity R0.4: local-only, opt-in spatial workshop placements.
   These are concept exhibits, not real-world construction or agent tool execution.
   Separate schema and storage key preserve existing R0.1/R0.2/R0.3 saves. */
export const WORKBENCH_SCHEMA = 'phifractalcity.workbench.v1';
export const WORKBENCH_KEY = 'phifractalcity:workbench:v1';
export const MAX_PLACEMENTS = 60;
const ADDRESS = /^0(?:\/[0-8]){0,8}$/;
const OWN_ID = /^w[1-9]\d{0,7}$/;
const ARTIFACT_ID = /^a[1-9]\d{0,7}$/;
const validDate = x => typeof x === 'string' && x.length >= 10 && x.length <= 40;

export function makeWorkbench() {
  return { schema: WORKBENCH_SCHEMA, sequence: 0, placements: [] };
}
export function assertWorkbench(bench) {
  if (!bench || typeof bench !== 'object' || Array.isArray(bench) ||
      bench.schema !== WORKBENCH_SCHEMA || !Number.isSafeInteger(bench.sequence) ||
      bench.sequence < 0 || bench.sequence > 10000000 ||
      !Array.isArray(bench.placements) || bench.placements.length > MAX_PLACEMENTS) {
    throw new Error('Invalid workbench format');
  }
  const ids = new Set();
  for (const p of bench.placements) {
    if (!p || !OWN_ID.test(p.id) || !ARTIFACT_ID.test(p.artifactId) ||
        !ADDRESS.test(p.address) || !Number.isInteger(p.x) || !Number.isInteger(p.z) ||
        p.x < -36 || p.x > 36 || p.z < -36 || p.z > 36 ||
        !Number.isInteger(p.yaw) || p.yaw < 0 || p.yaw > 7 ||
        !validDate(p.createdAt) || ids.has(p.id) || Number(p.id.slice(1)) > bench.sequence) {
      throw new Error('Invalid workbench placement');
    }
    ids.add(p.id);
  }
  return bench;
}
function findApproved(habitat, artifactId) {
  const artifact = habitat?.artifacts?.find(x => x?.id === artifactId);
  const source = habitat?.proposals?.find(x => x?.id === artifact?.proposalId);
  if (!artifact || !source || source.status !== 'approved') throw new Error('Approved artifact required');
  return artifact;
}
export function placeConcept(bench, habitat, artifactId, address) {
  assertWorkbench(bench);
  if (!ADDRESS.test(address)) throw new Error('Invalid placement pocket');
  const artifact = findApproved(habitat, artifactId);
  if (artifact.address !== address) throw new Error('Artifact belongs to another pocket');
  if (bench.placements.length >= MAX_PLACEMENTS) throw new Error('Workbench full; export or remove a placement');
  // Stable deterministic starting layout, intentionally away from the center crystal.
  const n = bench.placements.filter(x => x.address === address).length;
  const spots = [{x:8,z:7},{x:12,z:7},{x:8,z:11},{x:12,z:11},{x:-9,z:11},{x:-13,z:11}];
  const position = spots[n % spots.length];
  const placement = {
    id:'w' + (++bench.sequence), artifactId, address, x:position.x, z:position.z,
    yaw:0, createdAt:new Date().toISOString()
  };
  bench.placements.push(placement);
  return placement;
}
export function findPlacement(bench, id) {
  const item = bench?.placements?.find(x => x.id === id);
  if (!item) throw new Error('Unknown placement');
  return item;
}
export function moveConcept(bench, id, dx, dz) {
  if (!Number.isInteger(dx) || !Number.isInteger(dz) || Math.abs(dx) + Math.abs(dz) !== 1) {
    throw new Error('Movement must be one grid step');
  }
  const placement = findPlacement(bench,id);
  const nx=placement.x+dx,nz=placement.z+dz;
  if (nx < -36 || nx > 36 || nz < -36 || nz > 36) throw new Error('Placement reached district boundary');
  placement.x=nx;placement.z=nz;
  return placement;
}
export function turnConcept(bench,id,steps=1) {
  if (!Number.isInteger(steps) || Math.abs(steps)!==1) throw new Error('Rotation must be one step');
  const placement=findPlacement(bench,id);
  placement.yaw=(placement.yaw+steps+8)%8;
  return placement;
}
export function removeConcept(bench,id) {
  const index=bench.placements.findIndex(p=>p.id===id);
  if(index<0)throw new Error('Unknown placement');
  const [removed]=bench.placements.splice(index,1);
  return removed;
}
export function exportWorkbench(bench) {
  return JSON.stringify(assertWorkbench(bench),null,2);
}
export function parseWorkbench(text) {
  if (typeof text !== 'string' || text.length > 60000) throw new Error('Workbench JSON must be under 60KB');
  return assertWorkbench(JSON.parse(text));
}
export function loadWorkbench(storage) {
  try{
    const data=storage?.getItem(WORKBENCH_KEY);
    return data ? parseWorkbench(data) : makeWorkbench();
  }catch{return makeWorkbench();}
}
export function saveWorkbench(bench,storage) {
  try{
    if(!storage || typeof storage.setItem!=='function')return false;
    storage.setItem(WORKBENCH_KEY,exportWorkbench(bench));
    return true;
  }catch{return false;}
}
