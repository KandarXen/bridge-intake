import crypto from 'crypto';

function getEncryptionKey() {
  const raw = process.env.BTAI_ENCRYPTION_KEY;
  if (!raw) throw new Error('Missing BTAI_ENCRYPTION_KEY');

  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) return base64;

  const hex = Buffer.from(raw, 'hex');
  if (hex.length === 32) return hex;

  throw new Error('BTAI_ENCRYPTION_KEY must decode to 32 bytes using base64 or hex');
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

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
