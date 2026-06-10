// UI payload obfuscation (encode side).
//
// Wraps JSON POST bodies in {"_obf": base64(xor(json))} so payloads aren't
// casually readable/replayable from DevTools. Mirrors
// backend/common/obfuscation.py, which transparently unwraps the envelope.
//
// OBFUSCATION, NOT SECURITY: this key necessarily ships in the public JS
// bundle. TLS provides transport confidentiality; the server validates
// everything regardless. Keep in sync with the backend _KEY.

const KEY = "luts-store.payload.v1";

function xorBytes(data: Uint8Array): Uint8Array {
  const key = new TextEncoder().encode(KEY);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

function toBase64(bytes: Uint8Array): string {
  // btoa exists in browsers and Node 16+; chunk to avoid arg-length limits.
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Encode a JSON string into the obfuscation envelope body. */
export function envelope(json: string): string {
  try {
    const encoded = toBase64(xorBytes(new TextEncoder().encode(json)));
    return JSON.stringify({ _obf: encoded });
  } catch {
    // Encoding must never break a request — fall back to the plain body
    // (the backend accepts both forms).
    return json;
  }
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Reverse of {@link envelope}. Returns the original JSON string; if the body
 * isn't an `{_obf}` envelope it's returned unchanged. (Mainly for tests/debug;
 * the real decode happens in the Django middleware.) */
export function decodeEnvelope(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed._obf === "string" &&
      Object.keys(parsed).length === 1
    ) {
      return new TextDecoder().decode(xorBytes(fromBase64(parsed._obf)));
    }
  } catch {
    /* not JSON / not an envelope — fall through */
  }
  return body;
}
