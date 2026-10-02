import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import type { DomainTokenHeader } from "../../types/index.js";
import { algToCoseLabel } from "../cose/alg-labels.js";
import { Tag, encodeCbor } from "../cose/cbor.js";
import { COSE_TAG, encodeProtectedHeader } from "../cose/structures.js";
import { coseByJose } from "../header/header-registry.js";
import { domainTokenHeader } from "./domain-header.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";

const presentAndUndefined = (header: DomainTokenHeader): Array<string> =>
  Object.entries(header)
    .filter(([, value]) => value === undefined)
    .map(([member]) => member);

describe("the domain header a result reports", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora: IAmphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_OCT_KEY_ENC);
  });

  const signed = async (format: "jwt" | "cwt"): Promise<string> => {
    const claims = {
      iss: ISSUER,
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const { token } =
      format === "jwt" ? await aegis.jwt.sign(claims) : await aegis.cwt.sign(claims);

    return token;
  };

  describe.each(["jwt", "cwt"] as const)("for a %s", (format) => {
    test("aegis.verify reports no member as present and undefined", async () => {
      const verified = await aegis.verify(await signed(format));

      expect(presentAndUndefined(verified.header)).toStrictEqual([]);
    });

    test("aegis.parse reports no member as present and undefined", async () => {
      const parsed = aegis.parse(await signed(format));

      expect(presentAndUndefined(parsed.header)).toStrictEqual([]);
    });
  });

  describe("for a foreign cwt", () => {
    const der = new Uint8Array([0x30, 0x82, 0x01, 0xaa]);

    const foreign = (parameter: [number, unknown]): string =>
      encodeCbor(
        new Tag(
          COSE_TAG.cwt,
          new Tag(COSE_TAG.sign1, [
            encodeProtectedHeader(
              new Map<number, unknown>([
                [coseByJose("alg"), algToCoseLabel("ES512")],
                parameter,
              ]),
            ),
            new Map(),
            encodeCbor(new Map<number, unknown>([[1, ISSUER]])),
            Buffer.alloc(0),
          ]),
        ),
      ).toString("base64url");

    test("aegis.parse reports a certificate chain without its undefined member", () => {
      const parsed = aegis.parse(foreign([coseByJose("x5c"), [der, undefined]]));

      expect(parsed.header.certificateChain).toHaveLength(1);
    });

    test("aegis.parse reports a byte-string content type as the bytes it carried", () => {
      const parsed = aegis.parse(foreign([coseByJose("cty"), new Uint8Array([1, 2])]));

      expect(parsed.header.contentType).toStrictEqual(Buffer.from([1, 2]));
    });

    test("aegis.parse reports a map content type as the map it carried", () => {
      const parsed = aegis.parse(foreign([coseByJose("cty"), new Map([[1, "a"]])]));

      expect(parsed.header.contentType).toStrictEqual(new Map([[1, "a"]]));
    });
  });

  describe.each(["jwe", "cwe"] as const)("for a %s", (format) => {
    test("aegis.decrypt reports no member as present and undefined", async () => {
      const { token } = await aegis.encrypt("sealed", { format });

      const decrypted = await aegis.decrypt(token);

      expect(presentAndUndefined(decrypted.header)).toStrictEqual([]);
    });
  });
});

describe("domainTokenHeader", () => {
  test("a JOSE header carries the family its format names and the type its typ declares", () => {
    const header = domainTokenHeader(
      {
        protectedHeader: { alg: "ES256", typ: "application/at+jwt" },
        unprotectedHeader: {},
      },
      "jwt",
    );

    expect(header).toStrictEqual({
      algorithm: "ES256",
      baseFormat: "JWT",
      critical: [],
      headerType: "application/at+jwt",
      tokenType: "access_token",
    });
  });

  test("a typ that declares no token type leaves the token type absent", () => {
    const header = domainTokenHeader(
      { protectedHeader: { alg: "ES256", typ: "JWT" }, unprotectedHeader: {} },
      "jwt",
    );

    expect(header).toStrictEqual({
      algorithm: "ES256",
      baseFormat: "JWT",
      critical: [],
      headerType: "JWT",
    });
  });

  test("a JOSE header without a typ carries the family its format names", () => {
    const header = domainTokenHeader(
      { protectedHeader: { alg: "ES256" }, unprotectedHeader: {} },
      "jws",
    );

    expect(header).toStrictEqual({ algorithm: "ES256", baseFormat: "JWS", critical: [] });
  });

  test("a COSE header carries no JOSE family", () => {
    const header = domainTokenHeader(
      { protectedHeader: { alg: "ES256" }, unprotectedHeader: {} },
      "cwt",
    );

    expect(header).toStrictEqual({ algorithm: "ES256", critical: [] });
  });

  test("a COSE header carries no JOSE family even where its typ names one", () => {
    const header = domainTokenHeader(
      { protectedHeader: { alg: "ES256", typ: "JWT" }, unprotectedHeader: {} },
      "cwt",
    );

    expect(header).toStrictEqual({ algorithm: "ES256", critical: [], headerType: "JWT" });
  });
});
