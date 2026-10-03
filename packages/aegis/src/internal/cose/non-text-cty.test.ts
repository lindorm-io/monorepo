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
import { CoseError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { bareMediaType, reconstructContent } from "../utils/content-codec.js";
import { algToCoseLabel } from "./alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";
import { encodeCwtClaims } from "./cwt-claims.js";
import { encToCoseLabel } from "./enc-labels.js";

// Each export of the content codec a door hands a cty, wrapped in a spy that
// delegates to the original.
vi.mock("../utils/content-codec.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils/content-codec.js")>();

  return {
    ...original,
    bareMediaType: vi.fn(original.bareMediaType),
    reconstructContent: vi.fn(original.reconstructContent),
  };
});

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";
const NOW = 1704096000;

const CTY = coseByJose("cty");

const CLAIMS = encodeCbor(
  encodeCwtClaims({
    iss: ISSUER,
    sub: "user-1",
    exp: NOW + 3600,
    iat: NOW,
    cti: "token-1",
  }),
);

const TEXT = "hello cty";

/** A CWT a foreign producer signed, stating no cty: the nested token a `cty` 61 declares. */
const NESTED_CWT = foreignSignedCose(
  TEST_EC_KEY_SIG,
  new Map<CoseLabel, unknown>([
    [coseByJose("alg"), algToCoseLabel(TEST_EC_KEY_SIG.algorithm)],
    [coseByJose("typ"), "application/cwt"],
  ]),
  CLAIMS,
);

/**
 * The registered CoAP Content-Formats every door is driven with, each beside the
 * registry's `Content Type` for it and the content that type declares.
 */
const READ: ReadonlyArray<
  [id: number, mediaType: string, content: Buffer, reconstructed: unknown]
> = [
  [61, "application/cwt", NESTED_CWT, NESTED_CWT],
  [0, "text/plain; charset=utf-8", Buffer.from(TEXT, "utf8"), TEXT],
];

/** Every other non-text value every door is driven with under label 3. */
const REFUSED: ReadonlyArray<[shape: string, value: unknown]> = [
  ["a registered ID that carries a content coding", 11050],
  ["an unregistered integer", 1],
  ["a negative integer", -1],
  ["a byte string", Buffer.from("application/cwt", "utf8")],
  ["an array", ["application/cwt"]],
  ["a map", new Map<CoseLabel, unknown>([[1, "application/cwt"]])],
  ["null", null],
  ["false", false],
  ["a uint beyond the safe integers", 18446744073709551615n],
];

const UNREGISTERED = 1;

/** The protected bucket a foreign producer writes: `alg`, `typ` when stated, then `cty`. */
const protectedOf = (
  alg: number,
  typ: string | undefined,
  cty: unknown,
): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>([[coseByJose("alg"), alg]]);

  if (typ !== undefined) map.set(coseByJose("typ"), typ);
  map.set(CTY, cty);

  return map;
};

/** A COSE_Sign1 (or COSE_Mac0, by an `oct` key) a foreign producer signed. */
const signed = (kryptos: IKryptos, typ: string, cty: unknown, payload: Buffer): Buffer =>
  foreignSignedCose(
    kryptos,
    protectedOf(algToCoseLabel(kryptos.algorithm), typ, cty),
    payload,
  );

/** A COSE_Encrypt0 to the vault's `dir` key, stating no typ. */
const sealed = (cty: unknown, plaintext: Buffer): Buffer =>
  foreignEncrypt0(
    TEST_OCT_KEY_ENC,
    protectedOf(encToCoseLabel("A256GCM"), undefined, cty),
    plaintext,
  );

/**
 * The same token with `cty` written into its UNPROTECTED bucket beside what is
 * there. No signature or AEAD covers that bucket (RFC 9052 §3), so the token
 * stays valid.
 */
const withUnprotectedCty = (token: Buffer, cty: unknown): Buffer => {
  const [, unprotected] = decodeCbor<Tag>(token).contents as [unknown, unknown];
  const bucket = new Map(unprotected as Map<CoseLabel, unknown>);

  bucket.set(CTY, cty);

  return spliceCoseSlot(token, 1, bucket);
};

/** Every cty argument the content codec received, by function. */
const CTY_ARGUMENTS: ReadonlyArray<[name: string, received: () => Array<unknown>]> = [
  [
    "reconstructContent",
    () => vi.mocked(reconstructContent).mock.calls.map(([, cty]) => cty),
  ],
  ["bareMediaType", () => vi.mocked(bareMediaType).mock.calls.map(([cty]) => cty)],
];

/** Each cty the content codec received that is neither text nor absent. */
const nonTextCtysReceived = (): Array<[name: string, cty: unknown]> =>
  CTY_ARGUMENTS.flatMap(([name, received]) =>
    received()
      .filter((cty) => !(isString(cty) || isUndefined(cty)))
      .map((cty): [string, unknown] => [name, cty]),
  );

const refusalOf = async (open: () => Promise<unknown>): Promise<unknown> => {
  try {
    await open();
  } catch (error) {
    return error;
  }

  return undefined;
};

/** What a door reports a token's content type as, and the content it reconstructed. */
type Reading = { contentType: unknown; content?: unknown };

type Door = [
  door: string,
  open: (aegis: Aegis, token: string) => Promise<unknown>,
  read: (result: any) => Reading,
];

/** A door the content type reaches through `aegis.verify`'s domain header. */
const domainHeader = (result: any): Reading => ({
  contentType: result.header.contentType,
});

/** A door the content type reaches through a COSE kit's protected wire bucket. */
const protectedBucket = (result: any): Reading => ({
  contentType: result.protectedHeader.cty,
});

/** CWS reaches `aegis.verify`'s opaque path only typed `application/cws`. */
const OPAQUE_DOORS: ReadonlyArray<Door> = [
  [
    "aegis.cws.verify",
    (aegis, token) => aegis.cws.verify(token),
    (result) => ({ contentType: result.protectedHeader.cty, content: result.payload }),
  ],
  [
    "aegis.verify",
    (aegis, token) => aegis.verify(token),
    (result) => ({ contentType: result.header.contentType, content: result.raw }),
  ],
];

const CWT_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token), domainHeader],
  ["aegis.parse", async (aegis, token) => aegis.parse(token), domainHeader],
  ["aegis.cwt.verify", (aegis, token) => aegis.cwt.verify(token), protectedBucket],
];

const CWM_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token), domainHeader],
  ["aegis.parse", async (aegis, token) => aegis.parse(token), domainHeader],
  ["aegis.cwm.verify", (aegis, token) => aegis.cwm.verify(token), protectedBucket],
];

const SEALED_DOORS: ReadonlyArray<Door> = [
  [
    "aegis.cwe.decrypt",
    (aegis, token) => aegis.cwe.decrypt(token),
    (result) => ({ contentType: result.protectedHeader.cty, content: result.payload }),
  ],
  [
    "aegis.decrypt",
    (aegis, token) => aegis.decrypt(token),
    (result) => ({ contentType: result.contentType, content: result.payload }),
  ],
];

/**
 * AEGIS POLICY where it refuses an integer, not RFC 9052 §3.1 — the cty row in
 * `header-registry.ts`.
 *
 * Each door is driven with every value in `READ` and `REFUSED`;
 * `cose-wire-header.test.ts` drives the codec itself with the remaining shapes.
 * Each door is also shown accepting the same token with its cty in text, so a
 * refusal is the cty's and not the token's.
 */
describe("a COSE cty that is not a text string", () => {
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

  const refusedAsCtyInvalid = (thrown: unknown): void => {
    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown).toMatchObject({ code: "cose_header_cty_invalid" });
  };

  describe.each([
    [
      "a COSE_Sign1 typed application/cws",
      OPAQUE_DOORS,
      () => aegis,
      (cty: unknown, content: Buffer) =>
        signed(TEST_EC_KEY_SIG, "application/cws", cty, content),
    ],
    [
      "a COSE_Sign1 typed application/cwt",
      CWT_DOORS,
      () => aegis,
      (cty: unknown) => signed(TEST_EC_KEY_SIG, "application/cwt", cty, CLAIMS),
    ],
    [
      "a COSE_Mac0 typed application/cwt",
      CWM_DOORS,
      () => macAegis,
      (cty: unknown) => signed(TEST_OCT_KEY_SIG, "application/cwt", cty, CLAIMS),
    ],
    ["a COSE_Encrypt0", SEALED_DOORS, () => aegis, sealed],
  ] as const)("%s", (_structure, doors, aegisOf, mint) => {
    describe.each(doors)("at %s", (_door, open, read) => {
      test("accepts the token with its cty in text", async () => {
        const result = await open(
          aegisOf(),
          mint("application/cwt", NESTED_CWT).toString("base64url"),
        );

        expect(read(result).contentType).toBe("application/cwt");
      });

      test.each(READ)(
        "reads a protected cty %j as the registry's %j",
        async (id, mediaType, content, reconstructed) => {
          const result = await open(aegisOf(), mint(id, content).toString("base64url"));
          const reading = read(result);

          expect(reading.contentType).toBe(mediaType);
          if ("content" in reading) expect(reading.content).toStrictEqual(reconstructed);
        },
      );

      test("reads the provisional Content-Format 294 exactly as its text form application/kb+cwt", async () => {
        const integer = read(
          await open(aegisOf(), mint(294, NESTED_CWT).toString("base64url")),
        );
        const text = read(
          await open(
            aegisOf(),
            mint("application/kb+cwt", NESTED_CWT).toString("base64url"),
          ),
        );

        expect(text.contentType).toBe("application/kb+cwt");
        expect(integer).toStrictEqual(text);
      });

      test.each(REFUSED)("refuses a protected cty that is %s", async (_shape, cty) => {
        refusedAsCtyInvalid(
          await refusalOf(() =>
            open(aegisOf(), mint(cty, NESTED_CWT).toString("base64url")),
          ),
        );
      });

      test("refuses an unprotected cty that is an unregistered integer", async () => {
        const token = withUnprotectedCty(
          mint("application/cwt", NESTED_CWT),
          UNREGISTERED,
        );

        refusedAsCtyInvalid(
          await refusalOf(() => open(aegisOf(), token.toString("base64url"))),
        );
      });

      test("accepts an unprotected registered cty beside the protected one", async () => {
        const token = withUnprotectedCty(mint("application/cwt", NESTED_CWT), 61);

        await expect(open(aegisOf(), token.toString("base64url"))).resolves.toBeDefined();
      });

      test.each([
        ...READ.map(([id]): [string, unknown] => [`the registered ID ${id}`, id]),
        ...REFUSED,
      ])(
        "keeps a protected cty that is %s out of the content codec",
        async (_shape, cty) => {
          await refusalOf(() =>
            open(aegisOf(), mint(cty, NESTED_CWT).toString("base64url")),
          );

          expect(nonTextCtysReceived()).toStrictEqual([]);
        },
      );
    });
  });

  describe("at aegis.verify on a COSE_Encrypt0 outer", () => {
    test("verifies the nested token a protected cty 61 declares", async () => {
      const verified = await aegis.verify(sealed(61, NESTED_CWT).toString("base64url"));

      expect(verified).toMatchObject({
        format: "cwt",
        wrapper: "cwe",
        claims: { subject: "user-1" },
      });
    });

    test("reads a protected cty 0 as text, and refuses the text for carrying no signed token", async () => {
      const thrown = await refusalOf(() =>
        aegis.verify(sealed(0, Buffer.from(TEXT, "utf8")).toString("base64url")),
      );

      expect(thrown).toMatchObject({ code: "verify_requires_signature" });
    });

    test.each(REFUSED)("refuses a protected cty that is %s", async (_shape, cty) => {
      refusedAsCtyInvalid(
        await refusalOf(() =>
          aegis.verify(sealed(cty, NESTED_CWT).toString("base64url")),
        ),
      );
    });

    test("refuses an unprotected cty that is an unregistered integer", async () => {
      const token = withUnprotectedCty(
        sealed("application/cwt", NESTED_CWT),
        UNREGISTERED,
      );

      refusedAsCtyInvalid(
        await refusalOf(() => aegis.verify(token.toString("base64url"))),
      );
    });

    test("accepts an unprotected registered cty beside the protected one", async () => {
      const token = withUnprotectedCty(sealed("application/cwt", NESTED_CWT), 61);

      await expect(aegis.verify(token.toString("base64url"))).resolves.toMatchObject({
        format: "cwt",
        wrapper: "cwe",
      });
    });

    test.each([
      ...READ.map(([id]): [string, unknown] => [`the registered ID ${id}`, id]),
      ...REFUSED,
    ])(
      "keeps a protected cty that is %s out of the content codec",
      async (_shape, cty) => {
        await refusalOf(() =>
          aegis.verify(sealed(cty, NESTED_CWT).toString("base64url")),
        );

        expect(nonTextCtysReceived()).toStrictEqual([]);
      },
    );
  });

  // ⚠ Without these two the rows above pass vacuously if the mocks stop
  // intercepting.
  test("observes the text cty a signed door hands the content codec", async () => {
    await aegis.cws.verify(
      signed(
        TEST_EC_KEY_SIG,
        "application/cws",
        "text/plain",
        Buffer.from(TEXT),
      ).toString("base64url"),
    );

    expect(vi.mocked(reconstructContent)).toHaveBeenCalledWith(
      expect.any(Buffer),
      "text/plain",
    );
  });

  test("observes the text cty an encrypted outer hands the content codec", async () => {
    await aegis.verify(sealed("application/cwt", NESTED_CWT).toString("base64url"));

    expect(vi.mocked(reconstructContent)).toHaveBeenCalledWith(
      expect.any(Buffer),
      "application/cwt",
    );
    expect(vi.mocked(bareMediaType)).toHaveBeenCalledWith("application/cwt");
  });
});
