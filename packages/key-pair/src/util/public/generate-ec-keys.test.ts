import { generateEcKeys } from "./generate-ec-keys";
import { Algorithm, NamedCurve } from "../../enum";

describe("generateECCKeys", () => {
  test("should generate with default options", async () => {
    const result = await generateEcKeys();

    expect(result.algorithms).toStrictEqual([Algorithm.ES512]);

    expect(result.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(result.publicKey).toContain("-----END PUBLIC KEY-----");
    expect(result.publicKey.length).toBe(268);

    expect(result.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(result.privateKey).toContain("-----END PRIVATE KEY-----");
    expect(result.privateKey.length).toBe(384);
  });

  test("should generate with namedCurve P-384", async () => {
    const result = await generateEcKeys({
      namedCurve: NamedCurve.P384,
    });

    expect(result.algorithms).toStrictEqual([Algorithm.ES384]);

    expect(result.publicKey.length).toBe(215);
    expect(result.privateKey.length).toBe(306);
  });

  test("should generate with namedCurve P-256", async () => {
    const result = await generateEcKeys({
      namedCurve: NamedCurve.P256,
    });

    expect(result.algorithms).toStrictEqual([Algorithm.ES256]);

    expect(result.publicKey.length).toBe(178);
    expect(result.privateKey.length).toBe(241);
  });
});
