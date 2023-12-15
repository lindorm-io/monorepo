import { ClientError } from "@lindorm-io/errors";
import { RsaAlgorithm, RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { TEST_PRIVATE_KEY } from "../fixtures/integration/test-public-keys";
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
      key: TEST_PRIVATE_KEY,
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
      hash: "B+n3Nx3Y9yP6ObHlwmf/2Jji8sL+YaLfmYupJevaHQzdjcl4Jx2HS0wjfhQ5vgN9llzilKw4hDMGVZIjEYsJuuHea59/6V3SATDpbArb8zqfVWlX1cpHfR79Q/x0hchNR3cF4Xvw9H+K4aJ1r53NCWAyIc9NC2NH4yCu21BkaITmF4Qofq5110Mkn1XkRjMspoImRvaVSu8mKA6cmOoF0awQz2DgaV+zVMCMGoMbjc1uGsDAkOLmr5/4NrfEraexDXNYXTZes1jn6AhTOp+OOWE+jX2JkRFevNELZvDy6cRCv1L/DzauWOKzR/EFUB0phSdY0GIUacu3hxDdpdgWTL49uKw833NA+52w+KbaOeYgTNC1ZSqhVsRCqs5viBwuNDOTXJh1nOA+roLatOI9ha0rIZepoiTXuMDBqVoy4ZDwMvfYXm3BoCB46UIJsMmLse2ZnwtdDUfsZ3OdvsQ+JpT+nWapxO3drNQGXsJsraKFFywQbbepsi8O9GBln0L3MnvErf6jTRJBpqNG7Y55waz+E093FWTxYbOE2k5/k+CsdDYsoUVXcLWOD9X0C/FA9BmCnPrkKegjNSzrEWhbAuaFq385WrhlreZJ0K80d9gxvO00pZ5GyIVxDsWaIANaoDsaO3ElT+JfTA3Q6lUgwrgP0qDGUlgSvEdWFedZE4o=",
      headers: ["date", "digest", "foo", "bar", "baz"],
      key: "040c34af-1e6c-4821-b18c-bd433b0c9c4b",
    });
  });

  test("should resolve signature data with other valid algorithms and formats", () => {
    hash = createRsaSignature({
      algorithm: RsaAlgorithm.RSA_SHA256,
      data: JSON.stringify(content),
      format: RsaFormat.HEX,
      key: TEST_PRIVATE_KEY,
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
      hash: "6759ee2fde60473aea980829711eb33c2afe8d2e6f9c1cacc72f058efcab7b5b6c80de136f71a35f564d4fe5d0e9f6a738fd8cd6eb842873a3de19624f5dfe041b3027b06b4e9bbb4e2a3c179dfca2e95296d2aa2875920b81155927298f4764c96dcd8b4210bf323a375efb61aa362fd5c59d1a8205100aeb661bb2f5e3e4f60f5c9a0fbc1e34d397b4947e8e6b25bcda77439681571c2b1556070c40ff2e8c4b1f62ce2af7dfd3f9eaf39914782da563491671b46619b5db0e5250a4f8899d42ec2536efaab1a1e63b437bb1e430f50f4b9b2ee06232301d42211503af58cf7c904c31431f99f0a0df30745f3dd14b91cbca3f14f847386ec59ead46835baffd72d5e297c9e0c6d50e086be81f8e0edf338dc8f8e32bfc8758484c8c3318d4a821ae2ce2646bce1f49e02abd63e9b546d0487923f5b71077ed9d2471a7d4024a581b31104c21dc63cba024309ba1760f189f8f1237055416abae1314bbd2b1a54ea074be0b2643e7031a9cffa7cad04fda583437da953928f0d7a899f954f3ef1b3b9259edf13ee22c4662b4ab70e27e6e071998f1420434e75effdc77635fc74378d2c412cee1f9facd465a498f8ba07cc8ce798021439c8797689c3f95947c60fc7fac54e015994d5a6614936ff835500746bcceddc99c26770f5f2fb57cee9680a761640d27640586d7416b735a451f60b8c7759f626d35bc88d2f46c64",
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
