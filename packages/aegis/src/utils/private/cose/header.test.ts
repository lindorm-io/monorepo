import { Dict } from "@lindorm/types";
import { decodeCoseHeader, mapCoseHeader } from "./header";

describe("mapCoseHeader", () => {
  let header: Dict;

  beforeEach(() => {
    header = {
      alg: "ECDH-ES",
      crit: ["alg", "cty", "epk"],
      cty: "application/cwt",
      // enc: "A128GCM",
      epk: {
        crv: "X25519",
        d: "d-private-key",
        kty: "OKP",
        x: "x-coordinate",
      },
      iv: "iv",
      jku: "https://example.com/jwks.json",
      jwk: {
        alg: "ES256",
        crv: "P-256",
        d: "d-private-key",
        kid: "770c4118-fb8a-588e-a07d-22f68349eb4e",
        kty: "EC",
        use: "sig",
        x: "x-coordinate",
        y: "y-coordinate",
      },
      kid: "79b9cb6d-94d7-5d26-aa8c-f9b8c5f49a80",
      oid: "a7efea00-310a-50fb-936f-bf12a4fc0799",
      p2c: 1234567890,
      p2s: "p2s-salt",
      tag: "tag",
      typ: "application/cwt",
      x5c: ["certificate1", "certificate2"],
      x5t: "x5t",
      x5u: "https://example.com/certificate",
    };
  });

  test("should map COSE header with alg", () => {
    expect(mapCoseHeader(header as any)).toMatchSnapshot();
  });

  test("should map COSE header with enc", () => {
    header.alg = undefined;
    header.enc = "A128GCM";
    expect(mapCoseHeader(header as any)).toMatchSnapshot();
  });

  test("should decode mapped COSE header", () => {
    expect(decodeCoseHeader(mapCoseHeader(header as any))).toEqual(header);
  });
});
