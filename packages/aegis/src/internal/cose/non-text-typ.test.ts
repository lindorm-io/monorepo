import { Amphora, type IAmphora } from "@lindorm/amphora";
import { isString, isUndefined } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { foreignEncrypt0 } from "../../__fixtures__/foreign-encrypt0.js";
import { foreignSignedCose } from "../../__fixtures__/foreign-signed-cose.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { spliceCoseSlot } from "../../__fixtures__/splice-cose-slot.js";
import { Aegis } from "../../classes/Aegis.js";
import { CweKit } from "../../classes/CweKit.js";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { CoseError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { decodeTokenTypeFromTyp, getBaseFormat } from "../utils/compute-typ-header.js";
import { mediaTypeMatches, normaliseMediaType } from "../utils/media-type-matches.js";
import { algToCoseLabel } from "./alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";
import { encodeCwtClaims } from "./cwt-claims.js";
import { encToCoseLabel } from "./enc-labels.js";

// Each export a door hands a header typ, wrapped in a spy that delegates to the
// original. The others take what a mint writes: a caller's prefix, token type or
// profile typ.
vi.mock("../utils/compute-typ-header.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../utils/compute-typ-header.js")>();

  return {
    ...original,
    decodeTokenTypeFromTyp: vi.fn(original.decodeTokenTypeFromTyp),
    getBaseFormat: vi.fn(original.getBaseFormat),
  };
});

vi.mock("../utils/media-type-matches.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../utils/media-type-matches.js")>();

  return {
    ...original,
    mediaTypeMatches: vi.fn(original.mediaTypeMatches),
    normaliseMediaType: vi.fn(original.normaliseMediaType),
  };
});

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";
const NOW = 1704096000;

const TYP = coseByJose("typ");

const CLAIMS = encodeCbor(
  encodeCwtClaims({
    iss: ISSUER,
    sub: "user-1",
    aud: [RESOURCE],
    exp: NOW + 3600,
    iat: NOW,
    cti: "token-1",
    client_id: "client-1",
  }),
);

/** The non-text values every door is driven with under label 16. */
const NOT_TEXT: ReadonlyArray<[shape: string, value: unknown]> = [
  ["the uint 0", 0],
  ["a CoAP Content-Format uint", 61],
  ["a negative integer", -1],
  ["false", false],
  ["true", true],
  ["null", null],
  ["a byte string", Buffer.from("application/at+cwt", "utf8")],
  ["an array", ["application/at+cwt"]],
  ["a map", new Map<CoseLabel, unknown>([[1, "application/at+cwt"]])],
];

const UINT = 61;

/** The protected bucket a foreign producer writes: `alg`, then `typ` unless absent. */
const protectedOf = (
  alg: number,
  typ: unknown,
  rest: ReadonlyArray<[CoseLabel, unknown]> = [],
): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>([[coseByJose("alg"), alg], ...rest]);

  if (typ !== undefined) map.set(TYP, typ);

  return map;
};

/** A CWT signed (or MAC'd, by an `oct` key) by a foreign producer, `kid` unprotected. */
const signedCwt = (kryptos: IKryptos, typ: unknown): Buffer =>
  foreignSignedCose(kryptos, protectedOf(algToCoseLabel(kryptos.algorithm), typ), CLAIMS);

/** A COSE_Encrypt0 to the vault's `dir` key, sealing a signed CWT the vault verifies. */
const sealedCwt = (typ: unknown): Buffer =>
  foreignEncrypt0(
    TEST_OCT_KEY_ENC,
    protectedOf(encToCoseLabel("A256GCM"), typ, [[coseByJose("cty"), "application/cwt"]]),
    signedCwt(TEST_EC_KEY_SIG, "application/at+cwt"),
  );

/**
 * The same token with `typ` written into its UNPROTECTED bucket beside what is
 * there. No signature or AEAD covers that bucket (RFC 9052 §3), so the token
 * stays valid.
 */
const withUnprotectedTyp = (token: Buffer, typ: unknown): Buffer => {
  const [, unprotected] = decodeCbor<Tag>(token).contents as [unknown, unknown];
  const bucket = new Map(unprotected as Map<CoseLabel, unknown>);

  bucket.set(TYP, typ);

  return spliceCoseSlot(token, 1, bucket);
};

/** Every typ argument the media-type code received, by function. */
const TYP_ARGUMENTS: ReadonlyArray<[name: string, received: () => Array<unknown>]> = [
  ["getBaseFormat", () => vi.mocked(getBaseFormat).mock.calls.map(([typ]) => typ)],
  [
    "decodeTokenTypeFromTyp",
    () => vi.mocked(decodeTokenTypeFromTyp).mock.calls.map(([typ]) => typ),
  ],
  [
    "mediaTypeMatches",
    () => vi.mocked(mediaTypeMatches).mock.calls.flatMap((typs) => typs),
  ],
  [
    "normaliseMediaType",
    () => vi.mocked(normaliseMediaType).mock.calls.map(([typ]) => typ),
  ],
];

/** Each typ the media-type code received that is neither text nor absent. */
const nonTextTypsReceived = (): Array<[name: string, typ: unknown]> =>
  TYP_ARGUMENTS.flatMap(([name, received]) =>
    received()
      .filter((typ) => !(isString(typ) || isUndefined(typ)))
      .map((typ): [string, unknown] => [name, typ]),
  );

const refusalOf = async (open: () => Promise<unknown>): Promise<unknown> => {
  try {
    await open();
  } catch (error) {
    return error;
  }

  return undefined;
};

type Door = [
  door: string,
  open: (aegis: Aegis, token: string) => Promise<unknown>,
  /** The text typ a token this door accepts carries. */
  accepted: string,
];

const SIGNED_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token), "application/at+cwt"],
  [
    "aegis.verify under the access_token profile",
    (aegis, token) =>
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    "application/at+cwt",
  ],
  ["aegis.parse", async (aegis, token) => aegis.parse(token), "application/at+cwt"],
  ["aegis.cwt.verify", (aegis, token) => aegis.cwt.verify(token), "application/at+cwt"],
  [
    "aegis.cwt.verify asserting a token type",
    (aegis, token) => aegis.cwt.verify(token, undefined, { tokenType: "at" }),
    "application/at+cwt",
  ],
  ["aegis.cws.verify", (aegis, token) => aegis.cws.verify(token), "application/cws"],
  [
    "CwtKit.decode",
    async (_aegis, token) => CwtKit.decode(Buffer.from(token, "base64url")),
    "application/at+cwt",
  ],
  [
    "CwsKit.decode",
    async (_aegis, token) => CwsKit.decode(Buffer.from(token, "base64url")),
    "application/cws",
  ],
];

const MAC_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token), "application/at+cwt"],
  ["aegis.cwm.verify", (aegis, token) => aegis.cwm.verify(token), "application/at+cwt"],
  [
    "CwmKit.decode",
    async (_aegis, token) => CwmKit.decode(Buffer.from(token, "base64url")),
    "application/at+cwt",
  ],
];

const SEALED_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token), "application/at+cwe"],
  ["aegis.decrypt", (aegis, token) => aegis.decrypt(token), "application/at+cwe"],
  ["aegis.cwe.decrypt", (aegis, token) => aegis.cwe.decrypt(token), "application/at+cwe"],
  [
    "CweKit.decode",
    async (_aegis, token) => CweKit.decode(Buffer.from(token, "base64url")),
    "application/at+cwe",
  ],
];

/**
 * AEGIS POLICY, not RFC 9596 §4.1 — the typ row in `header-registry.ts`.
 *
 * Each door is driven with every value in `NOT_TEXT`; `cose-wire-header.test.ts`
 * drives the codec itself with the remaining shapes. Each door is also shown
 * accepting the same token typed in text, so a refusal is the typ's and not the
 * token's.
 */
describe("a COSE typ that is not a text string", () => {
  let logger: ILogger;
  let aegis: Aegis;
  let macAegis: Aegis;

  const deployment = async (...keys: Array<IKryptos>): Promise<Aegis> => {
    const amphora: IAmphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    await amphora.setup();
    for (const key of keys) amphora.add(key);

    return new Aegis({ amphora, logger });
  };

  beforeEach(async () => {
    logger = createMockLogger();
    // The MAC key gets its own vault, so no door chooses between two signing keys.
    aegis = await deployment(TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC);
    macAegis = await deployment(TEST_OCT_KEY_SIG);
    vi.clearAllMocks();
  });

  const refusedAsTypInvalid = (thrown: unknown): void => {
    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown).toMatchObject({ code: "cose_header_typ_invalid" });
  };

  describe.each([
    [
      "a COSE_Sign1",
      SIGNED_DOORS,
      () => aegis,
      (typ: unknown) => signedCwt(TEST_EC_KEY_SIG, typ),
    ],
    [
      "a COSE_Mac0",
      MAC_DOORS,
      () => macAegis,
      (typ: unknown) => signedCwt(TEST_OCT_KEY_SIG, typ),
    ],
    ["a COSE_Encrypt0", SEALED_DOORS, () => aegis, sealedCwt],
  ] as const)("%s", (_structure, doors, aegisOf, mint) => {
    describe.each(doors)("at %s", (_door, open, accepted) => {
      test("accepts the token typed in text", async () => {
        await expect(
          open(aegisOf(), mint(accepted).toString("base64url")),
        ).resolves.toBeDefined();
      });

      test.each(NOT_TEXT)("refuses a protected typ that is %s", async (_shape, typ) => {
        refusedAsTypInvalid(
          await refusalOf(() => open(aegisOf(), mint(typ).toString("base64url"))),
        );
      });

      test("refuses an unprotected typ that is a CoAP Content-Format uint", async () => {
        const token = withUnprotectedTyp(mint(accepted), UINT);

        refusedAsTypInvalid(
          await refusalOf(() => open(aegisOf(), token.toString("base64url"))),
        );
      });

      test("accepts an unprotected typ in text beside the protected one", async () => {
        const token = withUnprotectedTyp(mint(accepted), "application/at+cwt");

        await expect(open(aegisOf(), token.toString("base64url"))).resolves.toBeDefined();
      });

      test.each(NOT_TEXT)(
        "keeps a protected typ that is %s out of the media-type code",
        async (_shape, typ) => {
          await refusalOf(() => open(aegisOf(), mint(typ).toString("base64url")));

          expect(nonTextTypsReceived()).toStrictEqual([]);
        },
      );

      test("keeps an unprotected typ that is a CoAP Content-Format uint out of the media-type code", async () => {
        const token = withUnprotectedTyp(mint(accepted), UINT);

        await refusalOf(() => open(aegisOf(), token.toString("base64url")));

        expect(nonTextTypsReceived()).toStrictEqual([]);
      });
    });
  });

  // ⚠ Without these two the rows above pass vacuously if the mocks stop
  // intercepting.
  test("observes the text typ a domain verify hands the media-type code", async () => {
    await aegis.verify(
      "access_token",
      signedCwt(TEST_EC_KEY_SIG, "application/at+cwt").toString("base64url"),
      undefined,
      { audience: RESOURCE },
    );

    expect(vi.mocked(getBaseFormat)).toHaveBeenCalledWith("application/at+cwt");
    expect(vi.mocked(decodeTokenTypeFromTyp)).toHaveBeenCalledWith(
      "application/at+cwt",
      "cwt",
    );
    expect(vi.mocked(mediaTypeMatches)).toHaveBeenCalledWith(
      "application/at+cwt",
      expect.any(String),
    );
    expect(vi.mocked(normaliseMediaType)).toHaveBeenCalledWith("application/at+cwt");
  });

  test("observes the text typ a decrypt hands the media-type code", async () => {
    await aegis.decrypt(sealedCwt("application/at+cwe").toString("base64url"));

    expect(vi.mocked(decodeTokenTypeFromTyp)).toHaveBeenCalledWith(
      "application/at+cwe",
      "cwe",
    );
  });
});
