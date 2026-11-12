/* Side-effect-free verification gate for potentially destructive XR actions.
 * It is a UX confirmation, not authentication or authorization. */
const ACTIONS = new Set(['approve','decline','remove']);
export const REVIEW_WINDOW_MS = 10000;

export function reviewGate(previous, action, id, address, now = Date.now()) {
  if (!ACTIONS.has(action) ||
      typeof id !== 'string' || !/^[paw][1-9]\d{0,7}$/.test(id) ||
      typeof address !== 'string' || !/^0(?:\/[0-8]){0,8}$/.test(address) ||
      !Number.isFinite(now)) {
    throw new Error('Invalid XR confirmation request');
  }
  const key = action + ':' + id + ':' + address;
  if (previous?.key === key && previous.until > now) {
    return { confirmed:true, armed:null };
  }
  return {
    confirmed:false,
    armed:{ key, action, until:now+REVIEW_WINDOW_MS }
  };
}
