import { ClientError } from "@lindorm-io/errors";
import { RsaAlgorithm, RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { RSA_KEY_SET } from "../fixtures/integration/rsa-keys.fixture";
import { destructHeaderSignature } from "./destruct-header-signature";

describe("destructHeaderSignature", () => {
  let content: any;
  let headers: any;
  let hash: any;
  let signature: string;

  beforeEach(() => {
    content = {
      foo: "bar",
      bar: "baz",
      random: "TNUakzVKuuVNeESg",
    };

    headers = ["Date", "Digest", "Foo", "Bar", "Baz"].join(" ");

    hash = createRsaSignature({
      algorithm: RsaAlgorithm.RSA_SHA512,
      data: JSON.stringify(content),
      format: RsaFormat.BASE64,
      keySet: RSA_KEY_SET,
    });

    signature = [
      `algorithm="${RsaAlgorithm.RSA_SHA512}"`,
      `format="${RsaFormat.BASE64}"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");
  });

  test("should resolve signature data", () => {
    expect(destructHeaderSignature(signature)).toStrictEqual({
      algorithm: "RSA-SHA512",
      format: "base64",
      hash: "SZ6VqVKwxoRVhVksMHSRkRIst84TbIm18MkMHgu5WGQ3JVgtDTfTpmnwBhoqs5nBfwifcvxJSr+leXvFkgOFGRCFI1ZcseaSQy0TRoU6ZN92r5P8SSknhjC12jvY2JPjW2q0kOFdYM8ulBSLZIWK71XqVOFV7uGw5GZKIb2CxlJ4Yhj5ojDUGLlwb+wgwHVBQB7/EOvrxVBZtiiBmFjL90Eh9pIux1LyvmNs6ic5UZzvEOGxXcoQFOH4voRNbuek1UJV2NNWkg5XFat1nEMw+2AYCdygpFAuyu2iaY5Rcr6SJlhJerg/pLlE/GNzRe0feb06wSMI53UR54ZQcvyh9spVJuciyygc/XIWALuOwFIBeuaju9+mTe+7eI33X8MV/ofLUVJtfAzaMcYOIQtRmJrXonqRwdIUGvxMWb+p5cvhSzOkKQew+27ArPSmXFxoOVnonosnB9O5/+60X1T6cdKRNcm5QhjCSDxtltpRnU7KJpTqi91K4SID3pIhaFAUf/zB+po6R0Zj8rXK4wTf6AeUHwwQVybyeWcfD3UYCuaWNo7zpqLCAWoxDV/3nSYXk1+y+V15Deo7S9QbJu4ZwcUe7htKXpl2hpjpqFwd3cLrgpDKcJarQ0vE0TvVtoVuvQvLnFM4hCCu4f1wO2RxnK3pnSN6Nni0OUUPthPnwig=",
      headers: ["date", "digest", "foo", "bar", "baz"],
      key: "040c34af-1e6c-4821-b18c-bd433b0c9c4b",
    });
  });

  test("should resolve signature data with other valid algorithms and formats", () => {
    hash = createRsaSignature({
      algorithm: RsaAlgorithm.RSA_SHA256,
      data: JSON.stringify(content),
      format: RsaFormat.HEX,
      keySet: RSA_KEY_SET,
    });

    signature = [
      `algorithm="${RsaAlgorithm.RSA_SHA256}"`,
      `format="${RsaFormat.HEX}"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(destructHeaderSignature(signature)).toStrictEqual({
      algorithm: RsaAlgorithm.RSA_SHA256,
      format: RsaFormat.HEX,
      hash: "2e7cb6e3efd4a6a06313b60a3589c6888d51314380cacd09bda8c2fe9d29d371914df43eadc0b46f6c15455b2f6118c10f19f7a4d388b9354728a8ec9bfaeabe40dc52f8fe35474f74bd5be8aaae913fc6c94007c332992b72d886571474930f4ae9d254f8df11d6775a273392e0b3fa3bdb7800264f53c9c869ae5f2fc90d5a4c28f1ba4fd5e39535e3a2a931102cc1dea1e142d0bc038ec48bbc87082929a6938980e9eb65d2598b19793f76af887a72253d29afbe52dc92b782f0335175f2cd04443e6f8fc5af0f9d9b1fdefebcfa71f49de31fd21fd90f33de89850527e7e510f994189f15a053dc29ef0b8372308e1e4a4c1fe14a74536bab0c98d5e157dc4b4922d5c70800dc349338811a713753f4265a356cbe76566b22fc5f8573967a12ec443b41d7f818a590c5610b9105c17ba923fc583d19146097003d88b0b5f156bc1aecc2568b8bcba4a3e991e3d3799fc22ac2bfc16a36251924559fd0f34e1b106613fca72182d6af25522cb0dcebd5162a7609d5ee9ee3a26570adfd73cebdf4dc135141bb72491c781f22ccf8924f1d903f022dee8f75a51576942479922b22bbdb96b5c061848b6794a91649c04b8d9f630c677ce98049fc7aeeffd4685270d1cfcff516f53dc9c4da397e6116bd31c8825ce183757f3ab6df9867cc4ba2094b06f9200efbe17d2149c4442dd38f01db48c370b24465a039858c6913",
      headers: ["date", "digest", "foo", "bar", "baz"],
      key: "040c34af-1e6c-4821-b18c-bd433b0c9c4b",
    });
  });

  test("should throw on missing algorithm", () => {
    signature = [
      `format="hex"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on invalid algorithm", () => {
    signature = [
      `algorithm="invalid"`,
      `format="hex"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on missing format", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on invalid format", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `format="invalid"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on missing hash", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on missing headers", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `hash="${hash}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on invalid headers (length)", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `hash="${hash}"`,
      `headers=""`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on invalid headers (date)", () => {
    headers = ["Digest", "Foo", "Bar", "Baz"].join(" ");

    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on invalid headers (digest)", () => {
    headers = ["Date", "Foo", "Bar", "Baz"].join(" ");

    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
      `key="040c34af-1e6c-4821-b18c-bd433b0c9c4b"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });

  test("should throw on missing key", () => {
    signature = [
      `algorithm="RSA-SHA256"`,
      `format="hex"`,
      `hash="${hash}"`,
      `headers="${headers}"`,
    ].join(",");

    expect(() => destructHeaderSignature(signature)).toThrow(ClientError);
  });
});
