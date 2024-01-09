import { OctKeySet } from "./OctKeySet";

describe("OctKeySet", () => {
  test("should generate", async () => {
    const generated = await OctKeySet.generate();

    expect(generated).toBeInstanceOf(OctKeySet);
    expect(generated.type).toBe("oct");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should create from jwk", () => {
    const created = OctKeySet.fromJwk({
      k: "UUZtKSFfTTZXaWx0WVNGd3FsWjVzRFRvcWVaTWZ4KjA",
      kty: "oct",
    });

    expect(created).toBeInstanceOf(OctKeySet);

    expect(created.export("jwk")).toStrictEqual({
      k: "UUZtKSFfTTZXaWx0WVNGd3FsWjVzRFRvcWVaTWZ4KjA",
      kty: "oct",
    });

    expect(created.export("pem")).toStrictEqual({
      privateKey: "QFm)!_M6WiltYSFwqlZ5sDToqeZMfx*0",
      type: "oct",
    });
  });

  test("should create from pem", () => {
    const created = OctKeySet.fromPem({
      privateKey: "QFm)!_M6WiltYSFwqlZ5sDToqeZMfx*0",
      type: "oct",
    });

    expect(created).toBeInstanceOf(OctKeySet);

    expect(created.export("jwk")).toStrictEqual({
      k: "UUZtKSFfTTZXaWx0WVNGd3FsWjVzRFRvcWVaTWZ4KjA",
      kty: "oct",
    });

    expect(created.export("pem")).toStrictEqual({
      privateKey: "QFm)!_M6WiltYSFwqlZ5sDToqeZMfx*0",
      type: "oct",
    });
  });

  test("should export to der", async () => {
    const generated = await OctKeySet.generate();
    const der = generated.export("der");

    expect(der).toStrictEqual({
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(OctKeySet.isDer(der)).toBe(true);
    expect(OctKeySet.isJwk(der)).toBe(false);
    expect(OctKeySet.isPem(der)).toBe(false);
  });

  test("should export to jwk", async () => {
    const generated = await OctKeySet.generate();
    const jwk = generated.export("jwk");

    expect(jwk).toStrictEqual({
      k: expect.any(String),
      kty: "oct",
    });

    expect(OctKeySet.isDer(jwk)).toBe(false);
    expect(OctKeySet.isJwk(jwk)).toBe(true);
    expect(OctKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to pem", async () => {
    const generated = await OctKeySet.generate();
    const pem = generated.export("pem");

    expect(pem).toStrictEqual({
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(OctKeySet.isDer(pem)).toBe(false);
    expect(OctKeySet.isJwk(pem)).toBe(false);
    expect(OctKeySet.isPem(pem)).toBe(true);
  });
});
