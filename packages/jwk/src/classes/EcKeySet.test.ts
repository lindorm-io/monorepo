import { EcKeySet } from "./EcKeySet";

describe("EcKeySet", () => {
  test("should generate", async () => {
    const generated = await EcKeySet.generate();

    expect(generated).toBeInstanceOf(EcKeySet);
    expect(generated.curve).toBe("P-521");
    expect(generated.type).toBe("EC");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should create from jwk", () => {
    const created = EcKeySet.fromJwk({
      crv: "P-521",
      d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
      x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
      y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      kty: "EC",
    });

    expect(created).toBeInstanceOf(EcKeySet);

    expect(created.export("jwk")).toStrictEqual({
      crv: "P-521",
      d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
      x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
      y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      kty: "EC",
    });

    expect(created.export("pem")).toStrictEqual({
      curve: "P-521",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB+1dzKp5FO/wISTaI\n" +
        "PHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA/wNd764XikWWse9jRRw\n" +
        "KLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW\n" +
        "3Q/IL7kfEtKycJ42z9UhP4adevymNBQ4J02/Yx/jswGcKMep28r825kUE64LbsUc\n" +
        "8b4/pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I/1/iDYJRkc3OwZ1+MYWN31i5r\n" +
        "tg==\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg/Us9l6I346gj1aIpauWE\n" +
        "mYywZmbVxtsesnUVFt0PyC+5HxLSsnCeNs/VIT+GnXr8pjQUOCdNv2Mf47MBnCjH\n" +
        "qdvK/NuZFBOuC27FHPG+P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CU\n" +
        "ZHNzsGdfjGFjd9Yua7Y=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "EC",
    });
  });

  test("should create from pem", () => {
    const created = EcKeySet.fromPem({
      curve: "P-521",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIApwPj+RsxkAB2+89G\n" +
        "/LFavz/SJ3GA8PD00NdsKWmS8e8Cw8TGb9rrFsjDVEMJx5fR9rUwLNskeOlCigLS\n" +
        "EYTrWOShgYkDgYYABAAj3lGilk/mJ4urzmeGD3DiJVRGbuepOkYdd1jfsSHRlPej\n" +
        "XNCk+y3sMLSAf/3Hw46i41fhySxg27nr5Nin2nPUGQFwbNkDfjapXriSVOe67ZZn\n" +
        "oq2PhijO8/PwevILjmuO7FTq1oy1SPFfQYdzYt3EjkW6a99FA8w8/KGLmIArkcz6\n" +
        "FQ==\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAI95RopZP5ieLq85nhg9w4iVURm7n\n" +
        "qTpGHXdY37Eh0ZT3o1zQpPst7DC0gH/9x8OOouNX4cksYNu56+TYp9pz1BkBcGzZ\n" +
        "A342qV64klTnuu2WZ6Ktj4YozvPz8HryC45rjuxU6taMtUjxX0GHc2LdxI5Fumvf\n" +
        "RQPMPPyhi5iAK5HM+hU=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "EC",
    });

    expect(created).toBeInstanceOf(EcKeySet);

    expect(created.export("jwk")).toStrictEqual({
      crv: "P-521",
      d: "AKcD4_kbMZAAdvvPRvyxWr8_0idxgPDw9NDXbClpkvHvAsPExm_a6xbIw1RDCceX0fa1MCzbJHjpQooC0hGE61jk",
      x: "ACPeUaKWT-Yni6vOZ4YPcOIlVEZu56k6Rh13WN-xIdGU96Nc0KT7LewwtIB__cfDjqLjV-HJLGDbuevk2Kfac9QZ",
      y: "AXBs2QN-NqleuJJU57rtlmeirY-GKM7z8_B68guOa47sVOrWjLVI8V9Bh3Ni3cSORbpr30UDzDz8oYuYgCuRzPoV",
      kty: "EC",
    });

    expect(created.export("pem")).toStrictEqual({
      curve: "P-521",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIApwPj+RsxkAB2+89G\n" +
        "/LFavz/SJ3GA8PD00NdsKWmS8e8Cw8TGb9rrFsjDVEMJx5fR9rUwLNskeOlCigLS\n" +
        "EYTrWOShgYkDgYYABAAj3lGilk/mJ4urzmeGD3DiJVRGbuepOkYdd1jfsSHRlPej\n" +
        "XNCk+y3sMLSAf/3Hw46i41fhySxg27nr5Nin2nPUGQFwbNkDfjapXriSVOe67ZZn\n" +
        "oq2PhijO8/PwevILjmuO7FTq1oy1SPFfQYdzYt3EjkW6a99FA8w8/KGLmIArkcz6\n" +
        "FQ==\n" +
        "-----END PRIVATE KEY-----\n",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAI95RopZP5ieLq85nhg9w4iVURm7n\n" +
        "qTpGHXdY37Eh0ZT3o1zQpPst7DC0gH/9x8OOouNX4cksYNu56+TYp9pz1BkBcGzZ\n" +
        "A342qV64klTnuu2WZ6Ktj4YozvPz8HryC45rjuxU6taMtUjxX0GHc2LdxI5Fumvf\n" +
        "RQPMPPyhi5iAK5HM+hU=\n" +
        "-----END PUBLIC KEY-----\n",
      type: "EC",
    });
  });

  test("should export to der", async () => {
    const generated = await EcKeySet.generate();
    const der = generated.export("der");

    expect(der).toStrictEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(EcKeySet.isDer(der)).toBe(true);
    expect(EcKeySet.isJwk(der)).toBe(false);
    expect(EcKeySet.isPem(der)).toBe(false);
  });

  test("should export both to jwk", async () => {
    const generated = await EcKeySet.generate();
    const jwk = generated.export("jwk", "both");

    expect(jwk).toStrictEqual({
      crv: "P-521",
      d: expect.any(String),
      x: expect.any(String),
      y: expect.any(String),
      kty: "EC",
    });

    expect(EcKeySet.isDer(jwk)).toBe(false);
    expect(EcKeySet.isJwk(jwk)).toBe(true);
    expect(EcKeySet.isPem(jwk)).toBe(false);
  });

  test("should export public to jwk", async () => {
    const generated = await EcKeySet.generate();
    const jwk = generated.export("jwk", "public");

    expect(jwk).toStrictEqual({
      crv: "P-521",
      x: expect.any(String),
      y: expect.any(String),
      kty: "EC",
    });

    expect(EcKeySet.isDer(jwk)).toBe(false);
    expect(EcKeySet.isJwk(jwk)).toBe(true);
    expect(EcKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to pem", async () => {
    const generated = await EcKeySet.generate();
    const pem = generated.export("pem");

    expect(pem).toStrictEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(EcKeySet.isDer(pem)).toBe(false);
    expect(EcKeySet.isJwk(pem)).toBe(false);
    expect(EcKeySet.isPem(pem)).toBe(true);
  });
});
