import { Dict } from "@lindorm/types";
import { decodeCoseHeader, mapCoseHeader } from "./header";

describe("mapCoseHeader", () => {
  let header: Dict;

  beforeEach(() => {
    header = {
      alg: "ECDH-ES",
      crit: ["alg", "cty", "epk"],
      cty: "application/cwt",
      epk: {
        crv: "X25519",
        d: "d-private-key",
        kty: "OKP",
        x: "x-coordinate",
      },
      iv: "iv",
      kid: "79b9cb6d-94d7-5d26-aa8c-f9b8c5f49a80",
      oid: "a7efea00-310a-50fb-936f-bf12a4fc0799",
      typ: "application/cwt",
      x5c: ["certificate1", "certificate2"],
      x5t: "x5t",
      x5u: "https://example.com/certificate",
    };
  });

  test("should map COSE header with key management algorithm", () => {
    expect(mapCoseHeader(header as any)).toMatchSnapshot();
  });

  test("should map COSE header with content encryption algorithm", () => {
    header.alg = "A128GCM";
    expect(mapCoseHeader(header as any)).toMatchSnapshot();
  });

  test("should decode mapped COSE header", () => {
    expect(decodeCoseHeader(mapCoseHeader(header as any))).toEqual(header);
  });
});
