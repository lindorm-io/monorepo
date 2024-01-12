import { OkpKeySet } from "./OkpKeySet";

describe("OkpKeySet", () => {
  test("should generate Ed25519 by default", async () => {
    const generated = await OkpKeySet.generate();

    expect(generated).toBeInstanceOf(OkpKeySet);
    expect(generated.curve).toBe("Ed25519");
    expect(generated.type).toBe("OKP");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should generate X25519", async () => {
    const generated = await OkpKeySet.generate("X25519");

    expect(generated).toBeInstanceOf(OkpKeySet);
    expect(generated.curve).toBe("X25519");
    expect(generated.type).toBe("OKP");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should create from jwk", () => {
    const created = OkpKeySet.fromJwk({
      crv: "Ed25519",
      d: "jhQXIDbGlRysHHsDxeb02nzb8xPD4G9qgPhMVGv9ay4",
      kid: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      kty: "OKP",
      x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
    });

    expect(created).toBeInstanceOf(OkpKeySet);

    expect(created.export("jwk")).toStrictEqual({
      crv: "Ed25519",
      d: "jhQXIDbGlRysHHsDxeb02nzb8xPD4G9qgPhMVGv9ay4",
      kid: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      kty: "OKP",
      x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
    });

    expect(created.export("pem")).toStrictEqual({
      id: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      curve: "Ed25519",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MC4CAQAwBQYDK2VwBCIEII4UFyA2xpUcrBx7A8Xm9Np82/MTw+BvaoD4TFRr/Wsu\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MCowBQYDK2VwAyEAcouqlejAGmC2THWSej7E2sREswvyl0/kudseDi1L+sE=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "OKP",
    });
  });

  test("should create from pem", () => {
    const created = OkpKeySet.fromPem({
      id: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      curve: "Ed25519",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MC4CAQAwBQYDK2VwBCIEII4UFyA2xpUcrBx7A8Xm9Np82/MTw+BvaoD4TFRr/Wsu\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MCowBQYDK2VwAyEAcouqlejAGmC2THWSej7E2sREswvyl0/kudseDi1L+sE=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "OKP",
    });

    expect(created).toBeInstanceOf(OkpKeySet);

    expect(created.export("jwk")).toStrictEqual({
      crv: "Ed25519",
      d: "jhQXIDbGlRysHHsDxeb02nzb8xPD4G9qgPhMVGv9ay4",
      kid: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      kty: "OKP",
      x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
    });

    expect(created.export("pem")).toStrictEqual({
      id: "c290631b-f6fa-5b48-87ba-fa42ffcd7d67",
      curve: "Ed25519",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MC4CAQAwBQYDK2VwBCIEII4UFyA2xpUcrBx7A8Xm9Np82/MTw+BvaoD4TFRr/Wsu\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MCowBQYDK2VwAyEAcouqlejAGmC2THWSej7E2sREswvyl0/kudseDi1L+sE=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "OKP",
    });
  });

  test("should export to b64", async () => {
    const generated = await OkpKeySet.generate();
    const b64 = generated.export("b64");

    expect(b64).toStrictEqual({
      id: expect.any(String),
      curve: "Ed25519",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "OKP",
    });

    expect(OkpKeySet.isB64(b64)).toBe(true);
    expect(OkpKeySet.isDer(b64)).toBe(false);
    expect(OkpKeySet.isJwk(b64)).toBe(false);
    expect(OkpKeySet.isPem(b64)).toBe(false);
  });

  test("should export to der", async () => {
    const generated = await OkpKeySet.generate();
    const der = generated.export("der");

    expect(der).toStrictEqual({
      id: expect.any(String),
      curve: "Ed25519",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "OKP",
    });

    expect(OkpKeySet.isB64(der)).toBe(false);
    expect(OkpKeySet.isDer(der)).toBe(true);
    expect(OkpKeySet.isJwk(der)).toBe(false);
    expect(OkpKeySet.isPem(der)).toBe(false);
  });

  test("should export both to jwk", async () => {
    const generated = await OkpKeySet.generate();
    const jwk = generated.export("jwk", "both");

    expect(jwk).toStrictEqual({
      crv: "Ed25519",
      d: expect.any(String),
      kid: expect.any(String),
      kty: "OKP",
      x: expect.any(String),
    });

    expect(OkpKeySet.isB64(jwk)).toBe(false);
    expect(OkpKeySet.isDer(jwk)).toBe(false);
    expect(OkpKeySet.isJwk(jwk)).toBe(true);
    expect(OkpKeySet.isPem(jwk)).toBe(false);
  });

  test("should export public to jwk", async () => {
    const generated = await OkpKeySet.generate();
    const jwk = generated.export("jwk", "public");

    expect(jwk).toStrictEqual({
      crv: "Ed25519",
      kid: expect.any(String),
      x: expect.any(String),
      kty: "OKP",
    });

    expect(OkpKeySet.isB64(jwk)).toBe(false);
    expect(OkpKeySet.isDer(jwk)).toBe(false);
    expect(OkpKeySet.isJwk(jwk)).toBe(true);
    expect(OkpKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to pem", async () => {
    const generated = await OkpKeySet.generate();
    const pem = generated.export("pem");

    expect(pem).toStrictEqual({
      id: expect.any(String),
      curve: "Ed25519",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "OKP",
    });

    expect(OkpKeySet.isB64(pem)).toBe(false);
    expect(OkpKeySet.isDer(pem)).toBe(false);
    expect(OkpKeySet.isJwk(pem)).toBe(false);
    expect(OkpKeySet.isPem(pem)).toBe(true);
  });
});
