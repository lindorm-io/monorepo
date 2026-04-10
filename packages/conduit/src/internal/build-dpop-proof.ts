import { DpopSigner } from "@lindorm/types";

type Options = {
  signer: DpopSigner;
  httpMethod: string;
  httpUri: string;
  accessToken?: string;
  nonce?: string;
};

// https://datatracker.ietf.org/doc/html/rfc9449#section-4.2
// Minimal RFC 3986 §6.2.2 normalization: strip query and fragment.
const normalizeHtu = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const stringToBase64Url = (value: string): string =>
  bytesToBase64Url(new TextEncoder().encode(value));

const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};

const randomJti = (): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));

export const buildDpopProof = async (options: Options): Promise<string> => {
  const header = {
    alg: options.signer.algorithm,
    typ: "dpop+jwt",
    jwk: options.signer.publicJwk,
  };

  const payload: Record<string, unknown> = {
    jti: randomJti(),
    htm: options.httpMethod,
    htu: normalizeHtu(options.httpUri),
    iat: Math.floor(Date.now() / 1000),
  };

  if (options.accessToken) {
    payload.ath = await sha256Base64Url(options.accessToken);
  }

  if (options.nonce) {
    payload.nonce = options.nonce;
  }

  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = await options.signer.sign(signingInput);
  const signatureB64 = bytesToBase64Url(signatureBytes);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
};
