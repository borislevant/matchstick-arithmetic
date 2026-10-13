const PLACEHOLDER = /replace|placeholder|your[_-]/i;

function requiredUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('APP_BASE_URL must be an HTTP(S) URL');
  return url.origin;
}

export function readConfig(env = process.env) {
  const stripeSecretKey = env.STRIPE_SECRET_KEY || '';
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
  if (stripeSecretKey.startsWith('sk_live_')) throw new Error('Live Stripe keys are disabled for this staging service');
  if (stripeSecretKey && !stripeSecretKey.startsWith('sk_test_') && !PLACEHOLDER.test(stripeSecretKey)) {
    throw new Error('STRIPE_SECRET_KEY must be a Stripe test-mode key');
  }
  const unlockSigningSecret = env.UNLOCK_SIGNING_SECRET || '';
  if (unlockSigningSecret.length < 32 || PLACEHOLDER.test(unlockSigningSecret)) {
    throw new Error('UNLOCK_SIGNING_SECRET must contain at least 32 non-placeholder characters');
  }
  const priceMinor = Number(env.FULL_VERSION_PRICE_MINOR || '100');
  const currency = (env.FULL_VERSION_CURRENCY || 'ils').toLowerCase();
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 1) throw new Error('FULL_VERSION_PRICE_MINOR must be a positive integer');
  if (!/^[a-z]{3}$/.test(currency)) throw new Error('FULL_VERSION_CURRENCY must be a three-letter code');
  const stripeConfigured = stripeSecretKey.startsWith('sk_test_')
    && stripeWebhookSecret.startsWith('whsec_')
    && !PLACEHOLDER.test(stripeSecretKey)
    && !PLACEHOLDER.test(stripeWebhookSecret);
  return {
    baseUrl: requiredUrl(env.APP_BASE_URL || 'http://127.0.0.1:4173'),
    databaseUrl: env.DATABASE_URL || '',
    unlockSigningSecret,
    stripeSecretKey,
    stripeWebhookSecret,
    stripeConfigured,
    priceMinor,
    currency,
  };
}
