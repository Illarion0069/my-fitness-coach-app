// AES-GCM encryption/decryption for Whoop OAuth tokens

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('WHOOP_TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('WHOOP_TOKEN_ENCRYPTION_KEY not configured');
  // Derive a 256-bit key from the secret using SHA-256
  const encoded = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey('raw', hash, { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  // Combine IV + ciphertext and base64-encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/** Check if a value looks like it's already encrypted (base64 with enough length for IV+data) */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 20) return false;
  try {
    const decoded = atob(value);
    return decoded.length > IV_LENGTH;
  } catch {
    return false;
  }
}
