import { createShaHash } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { destructHeaderDigest } from "./destruct-header-digest";

describe("destructHeaderDigest", () => {
  let content: any;
  let hash: string;
  let digest: string;

  beforeEach(() => {
    content = {
      foo: "bar",
      bar: "baz",
      random: "TNUakzVKuuVNeESg",
    };

    hash = createShaHash({
      algorithm: "SHA512",
      data: JSON.stringify(content),
      format: "base64",
    });

    digest = [`algorithm="SHA512"`, `format="base64"`, `hash="${hash}"`].join(",");
  });

  test("should resolve digest data", () => {
    expect(destructHeaderDigest(digest)).toStrictEqual({
      algorithm: "SHA512",
      format: "base64",
      hash: "CDfArYwmrrHV2CnGBP+y0uWZvHeSEAUNzAnGplRYZA/hICyhBKlfCC577qcyHAhvh8NGrLufKq0moA49PGcU6w==",
    });
  });

  test("should resolve digest data with other valid algorithms and format", () => {
    hash = createShaHash({
      algorithm: "SHA256",
      data: JSON.stringify(content),
      format: "hex",
    });

    digest = [`algorithm="SHA256"`, `format="hex"`, `hash="${hash}"`].join(",");

    expect(destructHeaderDigest(digest)).toStrictEqual({
      algorithm: "SHA256",
      format: "hex",
      hash: "4dac7b59365132bae20e6de4e86488f74f9c5e2728f69ca2d3c6392b20ddf89d",
    });
  });

  test("should throw on missing algorithm", () => {
    digest = [`format="base64"`, `hash="${hash}"`].join(",");

    expect(() => destructHeaderDigest(digest)).toThrow(ClientError);
  });

  test("should throw on invalid algorithm", () => {
    digest = [`algorithm="invalid"`, `format="base64"`, `hash="${hash}"`].join(",");

    expect(() => destructHeaderDigest(digest)).toThrow(ClientError);
  });

  test("should throw on missing format", () => {
    digest = [`algorithm="SHA512"`, `hash="${hash}"`].join(",");

    expect(() => destructHeaderDigest(digest)).toThrow(ClientError);
  });

  test("should throw on invalid format", () => {
    digest = [`algorithm="SHA512"`, `format="invalid"`, `hash="${hash}"`].join(",");

    expect(() => destructHeaderDigest(digest)).toThrow(ClientError);
  });

  test("should throw on missing hash", () => {
    digest = [`algorithm="SHA512"`, `format="base64"`].join(",");

    expect(() => destructHeaderDigest(digest)).toThrow(ClientError);
  });
});
