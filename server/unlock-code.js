import {createHmac,timingSafeEqual} from 'node:crypto';

export const PRODUCT = 'full_version';

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createUnlockCode(purchaseId, secret) {
  const payload = Buffer.from(JSON.stringify({purchaseId,product:PRODUCT})).toString('base64url');
  return `un_${payload}.${signature(payload,secret)}`;
}

export function verifyUnlockCode(code, secret) {
  if (typeof code !== 'string' || code.length > 512 || !code.startsWith('un_')) return null;
  const [payload,provided] = code.slice(3).split('.');
  if (!payload || !provided) return null;
  const expected = signature(payload,secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return parsed?.product === PRODUCT && typeof parsed?.purchaseId === 'string' ? parsed.purchaseId : null;
  } catch { return null; }
}
