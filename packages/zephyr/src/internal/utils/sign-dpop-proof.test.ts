import { signDpopProof, toPublicJwk } from "./sign-dpop-proof.js";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const decodePart = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));

describe("signDpopProof", () => {
  const FIXED_DATE = new Date("2026-04-11T12:00:00.000Z");
  const FIXED_JTI = "00000000-0000-4000-8000-000000000000";

  let keyPair: CryptoKeyPair;
  let publicJwk: JsonWebKey;

  beforeAll(async () => {
    keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  });

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(FIXED_DATE);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_JTI);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should produce a compact JWS of three base64url parts", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });

    const parts = proof.split(".");
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))).toBe(true);
  });

  it("should set header with alg ES256, typ dpop+jwt and public-only jwk", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });

    const header = decodePart(proof.split(".")[0]);
    expect(header).toEqual({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y },
    });
    expect(header.jwk).not.toHaveProperty("d");
  });

  it("should strip private-material fields from the embedded jwk", async () => {
    const jwkWithPrivate: JsonWebKey = {
      ...publicJwk,
      d: "private-key-material",
      key_ops: ["sign"],
    };

    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk: jwkWithPrivate,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });

    const header = decodePart(proof.split(".")[0]);
    expect(header.jwk).not.toHaveProperty("d");
    expect(header.jwk).not.toHaveProperty("key_ops");
  });

  it("should set jti, htm, htu and iat on the payload", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload).toEqual({
      jti: FIXED_JTI,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
      iat: Math.floor(FIXED_DATE.getTime() / 1000),
    });
  });

  it("should include the ath claim when accessToken is provided", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
      accessToken: "test-access-token",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload).toMatchObject({
      jti: FIXED_JTI,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });
    expect(payload.ath).toMatchSnapshot();
  });

  it("should omit the ath claim when accessToken is not provided", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload).not.toHaveProperty("ath");
  });

  it("should produce a signature that verifies against the public key (R||S format)", async () => {
    const proof = await signDpopProof({
      privateKey: keyPair.privateKey,
      publicJwk,
      htm: "GET",
      htu: "https://api.example.com/socket.io/",
      accessToken: "test-access-token",
    });

    const [headerB64, payloadB64, signatureB64] = proof.split(".");
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = Buffer.from(signatureB64, "base64url");

    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      signatureBytes as BufferSource,
      signingInput as BufferSource,
    );

    expect(verified).toBe(true);
    expect(signatureBytes).toHaveLength(64);
  });
});

describe("toPublicJwk", () => {
  it("should keep only kty, crv, x, y", () => {
    const input: JsonWebKey = {
      kty: "EC",
      crv: "P-256",
      x: "x-val",
      y: "y-val",
      d: "private",
      key_ops: ["sign"],
      alg: "ES256",
      ext: true,
    };

    expect(toPublicJwk(input)).toEqual({
      kty: "EC",
      crv: "P-256",
      x: "x-val",
      y: "y-val",
    });
  });
});
