import { RsaKeySet } from "./RsaKeySet";

describe("RsaKeySet", () => {
  test("should generate with default modulus", async () => {
    const generated = await RsaKeySet.generate();

    expect(generated).toBeInstanceOf(RsaKeySet);
    expect(generated.modulus).toBe(2048);
    expect(generated.type).toBe("RSA");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should generate with modulus at 1", async () => {
    const generated = await RsaKeySet.generate(1);

    expect(generated).toBeInstanceOf(RsaKeySet);
    expect(generated.modulus).toBe(1024);
    expect(generated.type).toBe("RSA");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should generate with modulus at 2", async () => {
    const generated = await RsaKeySet.generate(2);

    expect(generated).toBeInstanceOf(RsaKeySet);
    expect(generated.modulus).toBe(2048);
    expect(generated.type).toBe("RSA");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should generate with modulus at 3", async () => {
    const generated = await RsaKeySet.generate(3);

    expect(generated).toBeInstanceOf(RsaKeySet);
    expect(generated.modulus).toBe(3072);
    expect(generated.type).toBe("RSA");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should generate with modulus at 4", async () => {
    const generated = await RsaKeySet.generate(4);

    expect(generated).toBeInstanceOf(RsaKeySet);
    expect(generated.modulus).toBe(4096);
    expect(generated.type).toBe("RSA");
    expect(generated.export).toBeInstanceOf(Function);
  });

  test("should create from jwk", () => {
    const created = RsaKeySet.fromJwk({
      e: "AQAB",
      n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
      d: "lLlj4wQxl17vAbmki4UrxyxmXQYXlGkPuKnnt8ngFBxry9AtrIXOQhlG3idBYpQt_ldPUUqeNbXj678Wi2RXv5wlz6GifCpYdlgLfXP-AOdDZu4JQCNU9T96_Xa7F749QiJUL0H3bNinocDI_zWmT6Nz5phWzXw80Ug2nJMzSxE",
      p: "6fxiLOGTi1VjDEaxpI3i4B4JHpZSkhQBU-nAz1cfPWLv8VK8ecRs3qTGbzH0l_qPcbmxNnD8kEw61DM50iPSGw",
      q: "5Nrk-3euhGOVjMRACHnsEgqjkm-sx8N0hqKF8N33-M6zVQlt-cMYZOsaV-qEOdLUDhYk6B6oYn_N4Nn0HwJriQ",
      dp: "hhitTxlsTIMAA84UCsGCD31HLq9p3Ov4ItYpOOquLakg6AXJnGN1HVgDnUBc9CiVwtBv_kpchHobkPdWoNcElw",
      dq: "A5jFHIanAYGnKg0zjG6OHUJ5i6Whq4oQ3MTVIhH7AbgN7Xo2dkRwr7VaNqOC7H25w3bpoZRJxTKJA82pHoulMQ",
      qi: "28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDbE0EVlvsL-S8fqtg0u0vs6li_vQ6DvbUkluSnHbA4upiZpQ",
      kty: "RSA",
    });

    expect(created).toBeInstanceOf(RsaKeySet);

    expect(created.export("jwk")).toStrictEqual({
      e: "AQAB",
      n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
      d: "lLlj4wQxl17vAbmki4UrxyxmXQYXlGkPuKnnt8ngFBxry9AtrIXOQhlG3idBYpQt_ldPUUqeNbXj678Wi2RXv5wlz6GifCpYdlgLfXP-AOdDZu4JQCNU9T96_Xa7F749QiJUL0H3bNinocDI_zWmT6Nz5phWzXw80Ug2nJMzSxE",
      p: "6fxiLOGTi1VjDEaxpI3i4B4JHpZSkhQBU-nAz1cfPWLv8VK8ecRs3qTGbzH0l_qPcbmxNnD8kEw61DM50iPSGw",
      q: "5Nrk-3euhGOVjMRACHnsEgqjkm-sx8N0hqKF8N33-M6zVQlt-cMYZOsaV-qEOdLUDhYk6B6oYn_N4Nn0HwJriQ",
      dp: "hhitTxlsTIMAA84UCsGCD31HLq9p3Ov4ItYpOOquLakg6AXJnGN1HVgDnUBc9CiVwtBv_kpchHobkPdWoNcElw",
      dq: "A5jFHIanAYGnKg0zjG6OHUJ5i6Whq4oQ3MTVIhH7AbgN7Xo2dkRwr7VaNqOC7H25w3bpoZRJxTKJA82pHoulMQ",
      qi: "28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDbE0EVlvsL-S8fqtg0u0vs6li_vQ6DvbUkluSnHbA4upiZpQ",
      kty: "RSA",
    });

    expect(created.export("pem")).toStrictEqual({
      publicKey:
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIGJAoGBANEs2aYyZ47UBfWCm7ynbcD8WuCPkgDqXwVxQlkszVn80vIYQiDte/sN\n" +
        "jD10o4fu/nWFozuod9tpO+MeWDDjxec0s1BGQ4BEoeUaSq0b5nWxeD54LzKCC/EB\n" +
        "+qYaB80qoRQUQ0PfWeofJT5NkWS4ieRaLnbAdqgzd7G7tDtXMrlzAgMBAAE=\n" +
        "-----END RSA PUBLIC KEY-----\n",
      privateKey:
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIICXgIBAAKBgQDRLNmmMmeO1AX1gpu8p23A/Frgj5IA6l8FcUJZLM1Z/NLyGEIg\n" +
        "7Xv7DYw9dKOH7v51haM7qHfbaTvjHlgw48XnNLNQRkOARKHlGkqtG+Z1sXg+eC8y\n" +
        "ggvxAfqmGgfNKqEUFEND31nqHyU+TZFkuInkWi52wHaoM3exu7Q7VzK5cwIDAQAB\n" +
        "AoGBAJS5Y+MEMZde7wG5pIuFK8csZl0GF5RpD7ip57fJ4BQca8vQLayFzkIZRt4n\n" +
        "QWKULf5XT1FKnjW14+u/FotkV7+cJc+honwqWHZYC31z/gDnQ2buCUAjVPU/ev12\n" +
        "uxe+PUIiVC9B92zYp6HAyP81pk+jc+aYVs18PNFINpyTM0sRAkEA6fxiLOGTi1Vj\n" +
        "DEaxpI3i4B4JHpZSkhQBU+nAz1cfPWLv8VK8ecRs3qTGbzH0l/qPcbmxNnD8kEw6\n" +
        "1DM50iPSGwJBAOTa5Pt3roRjlYzEQAh57BIKo5JvrMfDdIaihfDd9/jOs1UJbfnD\n" +
        "GGTrGlfqhDnS1A4WJOgeqGJ/zeDZ9B8Ca4kCQQCGGK1PGWxMgwADzhQKwYIPfUcu\n" +
        "r2nc6/gi1ik46q4tqSDoBcmcY3UdWAOdQFz0KJXC0G/+SlyEehuQ91ag1wSXAkAD\n" +
        "mMUchqcBgacqDTOMbo4dQnmLpaGrihDcxNUiEfsBuA3tejZ2RHCvtVo2o4LsfbnD\n" +
        "dumhlEnFMokDzakei6UxAkEA28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDb\n" +
        "E0EVlvsL+S8fqtg0u0vs6li/vQ6DvbUkluSnHbA4upiZpQ==\n" +
        "-----END RSA PRIVATE KEY-----\n",
      type: "RSA",
    });
  });

  test("should create from pem", () => {
    const created = RsaKeySet.fromPem({
      publicKey:
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIGJAoGBANEs2aYyZ47UBfWCm7ynbcD8WuCPkgDqXwVxQlkszVn80vIYQiDte/sN\n" +
        "jD10o4fu/nWFozuod9tpO+MeWDDjxec0s1BGQ4BEoeUaSq0b5nWxeD54LzKCC/EB\n" +
        "+qYaB80qoRQUQ0PfWeofJT5NkWS4ieRaLnbAdqgzd7G7tDtXMrlzAgMBAAE=\n" +
        "-----END RSA PUBLIC KEY-----\n",
      privateKey:
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIICXgIBAAKBgQDRLNmmMmeO1AX1gpu8p23A/Frgj5IA6l8FcUJZLM1Z/NLyGEIg\n" +
        "7Xv7DYw9dKOH7v51haM7qHfbaTvjHlgw48XnNLNQRkOARKHlGkqtG+Z1sXg+eC8y\n" +
        "ggvxAfqmGgfNKqEUFEND31nqHyU+TZFkuInkWi52wHaoM3exu7Q7VzK5cwIDAQAB\n" +
        "AoGBAJS5Y+MEMZde7wG5pIuFK8csZl0GF5RpD7ip57fJ4BQca8vQLayFzkIZRt4n\n" +
        "QWKULf5XT1FKnjW14+u/FotkV7+cJc+honwqWHZYC31z/gDnQ2buCUAjVPU/ev12\n" +
        "uxe+PUIiVC9B92zYp6HAyP81pk+jc+aYVs18PNFINpyTM0sRAkEA6fxiLOGTi1Vj\n" +
        "DEaxpI3i4B4JHpZSkhQBU+nAz1cfPWLv8VK8ecRs3qTGbzH0l/qPcbmxNnD8kEw6\n" +
        "1DM50iPSGwJBAOTa5Pt3roRjlYzEQAh57BIKo5JvrMfDdIaihfDd9/jOs1UJbfnD\n" +
        "GGTrGlfqhDnS1A4WJOgeqGJ/zeDZ9B8Ca4kCQQCGGK1PGWxMgwADzhQKwYIPfUcu\n" +
        "r2nc6/gi1ik46q4tqSDoBcmcY3UdWAOdQFz0KJXC0G/+SlyEehuQ91ag1wSXAkAD\n" +
        "mMUchqcBgacqDTOMbo4dQnmLpaGrihDcxNUiEfsBuA3tejZ2RHCvtVo2o4LsfbnD\n" +
        "dumhlEnFMokDzakei6UxAkEA28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDb\n" +
        "E0EVlvsL+S8fqtg0u0vs6li/vQ6DvbUkluSnHbA4upiZpQ==\n" +
        "-----END RSA PRIVATE KEY-----\n",
      type: "RSA",
    });

    expect(created).toBeInstanceOf(RsaKeySet);

    expect(created.export("jwk")).toStrictEqual({
      e: "AQAB",
      n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
      d: "lLlj4wQxl17vAbmki4UrxyxmXQYXlGkPuKnnt8ngFBxry9AtrIXOQhlG3idBYpQt_ldPUUqeNbXj678Wi2RXv5wlz6GifCpYdlgLfXP-AOdDZu4JQCNU9T96_Xa7F749QiJUL0H3bNinocDI_zWmT6Nz5phWzXw80Ug2nJMzSxE",
      p: "6fxiLOGTi1VjDEaxpI3i4B4JHpZSkhQBU-nAz1cfPWLv8VK8ecRs3qTGbzH0l_qPcbmxNnD8kEw61DM50iPSGw",
      q: "5Nrk-3euhGOVjMRACHnsEgqjkm-sx8N0hqKF8N33-M6zVQlt-cMYZOsaV-qEOdLUDhYk6B6oYn_N4Nn0HwJriQ",
      dp: "hhitTxlsTIMAA84UCsGCD31HLq9p3Ov4ItYpOOquLakg6AXJnGN1HVgDnUBc9CiVwtBv_kpchHobkPdWoNcElw",
      dq: "A5jFHIanAYGnKg0zjG6OHUJ5i6Whq4oQ3MTVIhH7AbgN7Xo2dkRwr7VaNqOC7H25w3bpoZRJxTKJA82pHoulMQ",
      qi: "28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDbE0EVlvsL-S8fqtg0u0vs6li_vQ6DvbUkluSnHbA4upiZpQ",
      kty: "RSA",
    });

    expect(created.export("pem")).toStrictEqual({
      publicKey:
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIGJAoGBANEs2aYyZ47UBfWCm7ynbcD8WuCPkgDqXwVxQlkszVn80vIYQiDte/sN\n" +
        "jD10o4fu/nWFozuod9tpO+MeWDDjxec0s1BGQ4BEoeUaSq0b5nWxeD54LzKCC/EB\n" +
        "+qYaB80qoRQUQ0PfWeofJT5NkWS4ieRaLnbAdqgzd7G7tDtXMrlzAgMBAAE=\n" +
        "-----END RSA PUBLIC KEY-----\n",
      privateKey:
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIICXgIBAAKBgQDRLNmmMmeO1AX1gpu8p23A/Frgj5IA6l8FcUJZLM1Z/NLyGEIg\n" +
        "7Xv7DYw9dKOH7v51haM7qHfbaTvjHlgw48XnNLNQRkOARKHlGkqtG+Z1sXg+eC8y\n" +
        "ggvxAfqmGgfNKqEUFEND31nqHyU+TZFkuInkWi52wHaoM3exu7Q7VzK5cwIDAQAB\n" +
        "AoGBAJS5Y+MEMZde7wG5pIuFK8csZl0GF5RpD7ip57fJ4BQca8vQLayFzkIZRt4n\n" +
        "QWKULf5XT1FKnjW14+u/FotkV7+cJc+honwqWHZYC31z/gDnQ2buCUAjVPU/ev12\n" +
        "uxe+PUIiVC9B92zYp6HAyP81pk+jc+aYVs18PNFINpyTM0sRAkEA6fxiLOGTi1Vj\n" +
        "DEaxpI3i4B4JHpZSkhQBU+nAz1cfPWLv8VK8ecRs3qTGbzH0l/qPcbmxNnD8kEw6\n" +
        "1DM50iPSGwJBAOTa5Pt3roRjlYzEQAh57BIKo5JvrMfDdIaihfDd9/jOs1UJbfnD\n" +
        "GGTrGlfqhDnS1A4WJOgeqGJ/zeDZ9B8Ca4kCQQCGGK1PGWxMgwADzhQKwYIPfUcu\n" +
        "r2nc6/gi1ik46q4tqSDoBcmcY3UdWAOdQFz0KJXC0G/+SlyEehuQ91ag1wSXAkAD\n" +
        "mMUchqcBgacqDTOMbo4dQnmLpaGrihDcxNUiEfsBuA3tejZ2RHCvtVo2o4LsfbnD\n" +
        "dumhlEnFMokDzakei6UxAkEA28uVk7OXXF6ea5mL5fZfAcNt2auHPXwJAD1RUeDb\n" +
        "E0EVlvsL+S8fqtg0u0vs6li/vQ6DvbUkluSnHbA4upiZpQ==\n" +
        "-----END RSA PRIVATE KEY-----\n",
      type: "RSA",
    });
  });

  test("should export to der", async () => {
    const generated = await RsaKeySet.generate();
    const der = generated.export("der");

    expect(der).toStrictEqual({
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "RSA",
    });

    expect(RsaKeySet.isDer(der)).toBe(true);
    expect(RsaKeySet.isJwk(der)).toBe(false);
    expect(RsaKeySet.isPem(der)).toBe(false);
  });

  test("should export to both jwk", async () => {
    const generated = await RsaKeySet.generate();
    const jwk = generated.export("jwk", "both");

    expect(jwk).toStrictEqual({
      d: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      e: "AQAB",
      n: expect.any(String),
      p: expect.any(String),
      q: expect.any(String),
      qi: expect.any(String),
      kty: "RSA",
    });

    expect(RsaKeySet.isDer(jwk)).toBe(false);
    expect(RsaKeySet.isJwk(jwk)).toBe(true);
    expect(RsaKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to public jwk", async () => {
    const generated = await RsaKeySet.generate();
    const jwk = generated.export("jwk", "public");

    expect(jwk).toStrictEqual({
      e: "AQAB",
      n: expect.any(String),
      kty: "RSA",
    });

    expect(RsaKeySet.isDer(jwk)).toBe(false);
    expect(RsaKeySet.isJwk(jwk)).toBe(true);
    expect(RsaKeySet.isPem(jwk)).toBe(false);
  });

  test("should export to pem", async () => {
    const generated = await RsaKeySet.generate();
    const pem = generated.export("pem");

    expect(pem).toStrictEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });

    expect(RsaKeySet.isDer(pem)).toBe(false);
    expect(RsaKeySet.isJwk(pem)).toBe(false);
    expect(RsaKeySet.isPem(pem)).toBe(true);
  });
});
