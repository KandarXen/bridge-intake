import crypto from 'crypto';

function parseEncryptionKey(raw, label = 'BTAI_ENCRYPTION_KEY') {
  const value = String(raw || '').trim();
  if (!value) return null;

  const base64 = Buffer.from(value, 'base64');
  if (base64.length === 32) return base64;

  const hex = Buffer.from(value, 'hex');
  if (hex.length === 32) return hex;

  throw new Error(`${label} must decode to 32 bytes using base64 or hex`);
}

function getEncryptionKey() {
  const key = parseEncryptionKey(process.env.BTAI_ENCRYPTION_KEY);
  if (!key) throw new Error('Missing BTAI_ENCRYPTION_KEY');
  return key;
}

function getDecryptionKeys() {
  const keys = [getEncryptionKey()];
  const previousValues = String(process.env.BTAI_ENCRYPTION_KEY_PREVIOUS || process.env.BTAI_PREVIOUS_ENCRYPTION_KEYS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  previousValues.forEach((value, index) => {
    keys.push(parseEncryptionKey(value, `BTAI_ENCRYPTION_KEY_PREVIOUS[${index}]`));
  });
  return keys;
}

export function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value ?? null), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  };
}

export function decryptJson(payload) {
  if (!payload || payload.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported encrypted payload');
  }

  let lastError;
  for (const key of getDecryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(payload.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64')),
        decipher.final()
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Could not decrypt payload');
}
