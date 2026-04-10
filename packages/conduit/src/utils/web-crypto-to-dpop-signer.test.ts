import { webCryptoToDpopSigner } from "./web-crypto-to-dpop-signer";

describe("webCryptoToDpopSigner", () => {
  test("should produce a signer from an ES256 key pair", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const signer = await webCryptoToDpopSigner(keyPair);

    expect(signer.algorithm).toEqual("ES256");
    expect(signer.publicJwk.kty).toEqual("EC");
    expect(signer.publicJwk.crv).toEqual("P-256");
  });

  test("should produce a signer from an ES384 key pair", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-384" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const signer = await webCryptoToDpopSigner(keyPair);

    expect(signer.algorithm).toEqual("ES384");
  });

  test("should produce a signer from an RS256 key pair", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const signer = await webCryptoToDpopSigner(keyPair);

    expect(signer.algorithm).toEqual("RS256");
    expect(signer.publicJwk.kty).toEqual("RSA");
  });

  test("should produce a signer from a PS256 key pair", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const signer = await webCryptoToDpopSigner(keyPair);

    expect(signer.algorithm).toEqual("PS256");
  });

  test("should produce a signature that verifies against the public key", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const signer = await webCryptoToDpopSigner(keyPair);
    const data = new TextEncoder().encode("test-data");
    const signature = await signer.sign(data);

    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      keyPair.publicKey,
      signature as BufferSource,
      data as BufferSource,
    );

    expect(verified).toBe(true);
  });

  test("should throw on unsupported algorithm", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    )) as any;

    await expect(
      webCryptoToDpopSigner({
        privateKey: keyPair,
        publicKey: keyPair,
      } as CryptoKeyPair),
    ).rejects.toThrow(/Unsupported/);
  });
});
