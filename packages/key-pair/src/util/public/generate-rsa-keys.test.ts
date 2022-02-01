import { generateRsaKeys } from "./generate-rsa-keys";
import { Algorithm } from "../../enum";

describe("generateRSAKeys", () => {
  test("should generate with default options", async () => {
    const result = await generateRsaKeys();

    expect(result.algorithms).toStrictEqual([Algorithm.RS256, Algorithm.RS384, Algorithm.RS512]);

    expect(result.publicKey).toContain("-----BEGIN RSA PUBLIC KEY-----");
    expect(result.publicKey).toContain("-----END RSA PUBLIC KEY-----");
    expect(result.publicKey.length).toBe(775);

    expect(result.privateKey).toContain("-----BEGIN ENCRYPTED PRIVATE KEY-----");
    expect(result.privateKey).toContain("-----END ENCRYPTED PRIVATE KEY-----");
    expect(result.privateKey.length).toBe(3434);
  });

  test("should generate with modulusLength 1", async () => {
    const result = await generateRsaKeys({ modulusLength: 1 });

    expect(result.publicKey.length).toBe(251);
    expect(result.privateKey.length).toBe(1074);
  });

  test("should generate with modulusLength 2", async () => {
    const result = await generateRsaKeys({ modulusLength: 2 });

    expect(result.publicKey.length).toBe(426);
    expect(result.privateKey.length).toBe(1874);
  });

  test("should generate with modulusLength 3", async () => {
    const result = await generateRsaKeys({ modulusLength: 3 });

    expect(result.publicKey.length).toBe(601);
    expect(result.privateKey.length).toBe(2654);
  });

  test("should generate with passphrase", async () => {
    const result = await generateRsaKeys({ passphrase: "passphrase" });

    expect(result.publicKey.length).toBe(775);
    expect(result.privateKey.length).toBe(3434);
  });
});
