export type SignDpopProofOptions = {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  htm: string;
  htu: string;
  accessToken?: string;
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

export const toPublicJwk = (jwk: JsonWebKey): JsonWebKey => {
  const { kty, crv, x, y } = jwk;
  return { kty, crv, x, y };
};

export const signDpopProof = async (options: SignDpopProofOptions): Promise<string> => {
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: toPublicJwk(options.publicJwk),
  };

  const payload: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: options.htm,
    htu: options.htu,
    iat: Math.floor(Date.now() / 1000),
  };

  if (options.accessToken) {
    payload.ath = await sha256Base64Url(options.accessToken);
  }

  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    options.privateKey,
    signingInput as BufferSource,
  );

  const signatureB64 = bytesToBase64Url(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
};
