import { DpopSigner } from "@lindorm/types";
import MockDate from "mockdate";
import { buildDpopProof } from "./build-dpop-proof";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const decodePart = (part: string): any =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));

describe("buildDpopProof", () => {
  const publicJwk = { kty: "EC", crv: "P-256", x: "x-val", y: "y-val" } as any;
  const signer: DpopSigner = {
    algorithm: "ES256",
    publicJwk,
    sign: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
  };

  beforeEach(() => {
    (signer.sign as Mock).mockClear();
  });

  test("should build a compact JWS with header, payload and signature", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
    });

    const parts = proof.split(".");
    expect(parts).toHaveLength(3);
    expect(decodePart(parts[0])).toEqual({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: publicJwk,
    });
  });

  test("should set htm, htu, iat and jti on the payload", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload).toMatchObject({
      htm: "POST",
      htu: "https://api.example.com/orders",
      iat: Math.floor(MockedDate.getTime() / 1000),
    });
    expect(payload.jti).toEqual(expect.any(String));
    expect(payload.jti).toHaveLength(22);
  });

  test("should strip query and fragment from htu", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "GET",
      httpUri: "https://api.example.com/orders?limit=10#anchor",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload.htu).toEqual("https://api.example.com/orders");
  });

  test("should add ath claim when accessToken is provided", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
      accessToken: "test-access-token",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload.ath).toEqual(expect.any(String));
    // RFC 9449: base64url SHA-256 of ASCII access token. For a known
    // input this is deterministic — snapshot it.
    expect(payload.ath).toMatchSnapshot();
  });

  test("should omit ath claim when accessToken is not provided", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload).not.toHaveProperty("ath");
  });

  test("should include nonce when provided", async () => {
    const proof = await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
      nonce: "server-nonce",
    });

    const payload = decodePart(proof.split(".")[1]);
    expect(payload.nonce).toEqual("server-nonce");
  });

  test("should pass canonical signing input to the signer", async () => {
    await buildDpopProof({
      signer,
      httpMethod: "POST",
      httpUri: "https://api.example.com/orders",
    });

    expect(signer.sign).toHaveBeenCalledTimes(1);
    const [data] = (signer.sign as Mock).mock.calls[0];
    const signingInput = new TextDecoder().decode(data);
    const [headerB64, payloadB64] = signingInput.split(".");
    expect(headerB64).toBeTruthy();
    expect(payloadB64).toBeTruthy();
  });
});
