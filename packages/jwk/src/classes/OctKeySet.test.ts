import { OctKeySet } from "./OctKeySet";

describe("OctKeySet", () => {
  test("should generate", async () => {
    const generated = await OctKeySet.generate();

    expect(generated).toBeInstanceOf(OctKeySet);
    expect(generated.type).toBe("oct");
    expect(generated.export).toBeInstanceOf(Function);

    expect(generated.export("b64").privateKey.length).toBe(43);
    expect(generated.export("der").privateKey.length).toBe(32);
    expect(generated.export("jwk").k.length).toBe(43);
    expect(generated.export("pem").privateKey.length).toBe(32);
  });

  test("should create from jwk", () => {
    const created = OctKeySet.fromJwk({
      k: "YUlESEBWcUBGT3ZWSEVuZ1NkQEVyamx3QFNuc0F0TXU",
      kid: "0e81e739-cc88-537e-8571-aec1681e40a6",
      kty: "oct",
    });

    expect(created).toBeInstanceOf(OctKeySet);

    expect(created.export("b64")).toStrictEqual({
      id: "0e81e739-cc88-537e-8571-aec1681e40a6",
      privateKey: "YUlESEBWcUBGT3ZWSEVuZ1NkQEVyamx3QFNuc0F0TXU",
      type: "oct",
    });

    expect(created.export("jwk")).toStrictEqual({
      k: "YUlESEBWcUBGT3ZWSEVuZ1NkQEVyamx3QFNuc0F0TXU",
      kid: "0e81e739-cc88-537e-8571-aec1681e40a6",
      kty: "oct",
    });

    expect(created.export("pem")).toStrictEqual({
      id: "0e81e739-cc88-537e-8571-aec1681e40a6",
      privateKey: "aIDH@Vq@FOvVHEngSd@Erjlw@SnsAtMu",
      type: "oct",
    });
  });

  test("should create from pem", () => {
    const created = OctKeySet.fromPem({
      id: "0e81e739-cc88-537e-8571-aec1681e40a6",
      privateKey: "aIDH@Vq@FOvVHEngSd@Erjlw@SnsAtMu",
      type: "oct",
    });

    expect(created).toBeInstanceOf(OctKeySet);

    expect(created.export("b64")).toStrictEqual({
      id: "0e81e739-cc88-537e-8571-aec1681e40a6",
      privateKey: "YUlESEBWcUBGT3ZWSEVuZ1NkQEVyamx3QFNuc0F0TXU",
      type: "oct",
    });

    expect(created.export("jwk")).toStrictEqual({
      k: "YUlESEBWcUBGT3ZWSEVuZ1NkQEVyamx3QFNuc0F0TXU",
      kid: "0e81e739-cc88-537e-8571-aec1681e40a6",
      kty: "oct",
    });

    expect(created.export("pem")).toStrictEqual({
      id: "0e81e739-cc88-537e-8571-aec1681e40a6",
      privateKey: "aIDH@Vq@FOvVHEngSd@Erjlw@SnsAtMu",
      type: "oct",
    });
  });

  test("should export to b64", async () => {
    const generated = await OctKeySet.generate();
    const b64 = generated.export("b64");

    expect(b64).toStrictEqual({
      id: expect.any(String),
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(OctKeySet.isB64(b64)).toBe(true);
    expect(OctKeySet.isDer(b64)).toBe(false);
    expect(OctKeySet.isJwk(b64)).toBe(false);
    expect(OctKeySet.isPem(b64)).toBe(false);
  });

  test("should export to der", async () => {
    const generated = await OctKeySet.generate();
    const der = generated.export("der");

    expect(der).toStrictEqual({
      id: expect.any(String),
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(OctKeySet.isB64(der)).toBe(false);
    expect(OctKeySet.isDer(der)).toBe(true);
    expect(OctKeySet.isJwk(der)).toBe(false);
    expect(OctKeySet.isPem(der)).toBe(false);
  });

  test("should export to jwk", async () => {
    const generated = await OctKeySet.generate();
    const jwk = generated.export("jwk");

    expect(jwk).toStrictEqual({
      k: expect.any(String),
      kid: expect.any(String),
      kty: "oct",
    });

    expect(OctKeySet.isB64(jwk)).toBe(false);
    expect(OctKeySet.isDer(jwk)).toBe(false);
    expect(OctKeySet.isJwk(jwk)).toBe(true);
    expect(OctKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to pem", async () => {
    const generated = await OctKeySet.generate();
    const pem = generated.export("pem");

    expect(pem).toStrictEqual({
      id: expect.any(String),
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(OctKeySet.isB64(pem)).toBe(false);
    expect(OctKeySet.isDer(pem)).toBe(false);
    expect(OctKeySet.isJwk(pem)).toBe(false);
    expect(OctKeySet.isPem(pem)).toBe(true);
  });
});
