import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { foreignEncrypt0 } from "../../__fixtures__/foreign-encrypt0.js";
import { foreignSignedCose } from "../../__fixtures__/foreign-signed-cose.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { spliceCoseSlot } from "../../__fixtures__/splice-cose-slot.js";
import { Aegis } from "../../classes/Aegis.js";
import { coseByJose } from "../header/header-registry.js";
import { algToCoseLabel } from "./alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";
import { encodeCwtClaims } from "./cwt-claims.js";
import { encToCoseLabel } from "./enc-labels.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";
const NOW = 1704096000;

const IV = coseByJose("iv");

const CLAIMS = encodeCbor(
  encodeCwtClaims({
    iss: ISSUER,
    sub: "user-1",
    exp: NOW + 3600,
    iat: NOW,
    cti: "token-1",
  }),
);

/** The byte string a row states where the value under test is not one. */
const BYTES = Buffer.alloc(12, 0xfb);

/**
 * Non-bstr values every door is driven with under label 5. `Map.get` answers
 * `undefined` for the CBOR undefined, a value the producer stated.
 * `cose-wire-header.test.ts` drives the codec itself with the remaining shapes.
 */
const NOT_BYTES: ReadonlyArray<[shape: string, value: unknown]> = [
  ["a text string", BYTES.toString("base64url")],
  ["an integer", 5],
  ["null", null],
  ["the CBOR undefined", undefined],
];

/** The protected bucket a foreign producer writes: `alg`, `typ`, then the rest. */
const protectedOf = (
  alg: number,
  typ: string,
  rest: ReadonlyArray<[CoseLabel, unknown]>,
): Map<CoseLabel, unknown> =>
  new Map<CoseLabel, unknown>([
    [coseByJose("alg"), alg],
    [coseByJose("typ"), typ],
    ...rest,
  ]);

/** A COSE_Sign1 (or COSE_Mac0, by an `oct` key) a foreign producer signed. */
const signed = (
  kryptos: IKryptos,
  typ: string,
  payload: Buffer,
  rest: ReadonlyArray<[CoseLabel, unknown]> = [],
): Buffer =>
  foreignSignedCose(
    kryptos,
    protectedOf(algToCoseLabel(kryptos.algorithm), typ, rest),
    payload,
  );

/** A COSE_Encrypt0 to the vault's `dir` key, sealing a signed CWT the vault verifies. */
const sealed = (rest: ReadonlyArray<[CoseLabel, unknown]> = []): Buffer =>
  foreignEncrypt0(
    TEST_OCT_KEY_ENC,
    new Map<CoseLabel, unknown>([
      [coseByJose("alg"), encToCoseLabel("A256GCM")],
      [coseByJose("cty"), "application/cwt"],
      ...rest,
    ]),
    signed(TEST_EC_KEY_SIG, "application/cwt", CLAIMS),
  );

/**
 * The same token with label 5 set in its UNPROTECTED bucket — beside what is
 * there, or in place of the nonce a COSE_Encrypt0 carries there. No signature or
 * AEAD covers that bucket (RFC 9052 §3), so only the value under test changes.
 */
const withUnprotectedIv = (token: Buffer, iv: unknown): Buffer => {
  const [, unprotected] = decodeCbor<Tag>(token).contents as [unknown, unknown];
  const bucket = new Map(unprotected as Map<CoseLabel, unknown>);

  bucket.set(IV, iv);

  return spliceCoseSlot(token, 1, bucket);
};

/** What a door's refusal tells a caller: the class, the code, both bags and the message. */
const refusalOf = async (act: () => Promise<unknown>): Promise<unknown> => {
  try {
    await act();
  } catch (error) {
    const { name, code, data, debug, message } = error as Dict;

    return { name, code, data, debug, message };
  }

  throw new Error("the act was not refused");
};

type Door = [door: string, open: (aegis: Aegis, token: string) => Promise<unknown>];

const CWT_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token)],
  ["aegis.parse", async (aegis, token) => aegis.parse(token)],
  ["aegis.cwt.verify", (aegis, token) => aegis.cwt.verify(token)],
];

const CWM_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token)],
  ["aegis.parse", async (aegis, token) => aegis.parse(token)],
  ["aegis.cwm.verify", (aegis, token) => aegis.cwm.verify(token)],
];

const OPAQUE_DOORS: ReadonlyArray<Door> = [
  ["aegis.verify", (aegis, token) => aegis.verify(token)],
  ["aegis.cws.verify", (aegis, token) => aegis.cws.verify(token)],
];

const SEALED_DOORS: ReadonlyArray<Door> = [
  ["aegis.decrypt", (aegis, token) => aegis.decrypt(token)],
  ["aegis.cwe.decrypt", (aegis, token) => aegis.cwe.decrypt(token)],
  ["aegis.verify", (aegis, token) => aegis.verify(token)],
];

/**
 * RFC 9052 §3.1 — the iv row in `header-registry.ts`. Each door is also shown
 * reading the same token with its IV a byte string, so a refusal is the IV's and
 * not the token's.
 */
describe("the COSE IV (label 5)", () => {
  let aegis: Aegis;
  let macAegis: Aegis;

  const deployment = async (...keys: Array<IKryptos>): Promise<Aegis> => {
    const logger = createMockLogger();
    const amphora: IAmphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    await amphora.setup();
    for (const key of keys) amphora.add(key);

    return new Aegis({ amphora, logger });
  };

  beforeEach(async () => {
    aegis = await deployment(TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC);
    // The MAC key gets its own vault, so no door chooses between two signing keys.
    macAegis = await deployment(TEST_OCT_KEY_SIG);
  });

  describe.each([
    [
      "a COSE_Sign1 typed application/cwt",
      CWT_DOORS,
      () => aegis,
      (rest?: ReadonlyArray<[CoseLabel, unknown]>) =>
        signed(TEST_EC_KEY_SIG, "application/cwt", CLAIMS, rest),
    ],
    [
      "a COSE_Mac0 typed application/cwt",
      CWM_DOORS,
      () => macAegis,
      (rest?: ReadonlyArray<[CoseLabel, unknown]>) =>
        signed(TEST_OCT_KEY_SIG, "application/cwt", CLAIMS, rest),
    ],
    [
      "a COSE_Sign1 typed application/cws",
      OPAQUE_DOORS,
      () => aegis,
      (rest?: ReadonlyArray<[CoseLabel, unknown]>) =>
        signed(TEST_EC_KEY_SIG, "application/cws", Buffer.from("content"), rest),
    ],
  ] as const)("%s", (_structure, doors, aegisOf, mint) => {
    describe.each(doors)("at %s", (_door, open) => {
      test("accepts the token with a protected IV that is a byte string", async () => {
        const token = mint([[IV, BYTES]]).toString("base64url");

        await expect(open(aegisOf(), token)).resolves.toBeDefined();
      });

      test("accepts the token with an unprotected IV that is a byte string", async () => {
        const token = withUnprotectedIv(mint(), BYTES).toString("base64url");

        await expect(open(aegisOf(), token)).resolves.toBeDefined();
      });

      test.each(NOT_BYTES)("refuses a protected IV that is %s", async (_shape, iv) => {
        const token = mint([[IV, iv]]).toString("base64url");

        expect(await refusalOf(() => open(aegisOf(), token))).toMatchSnapshot();
      });

      test.each(NOT_BYTES)("refuses an unprotected IV that is %s", async (_shape, iv) => {
        const token = withUnprotectedIv(mint(), iv).toString("base64url");

        expect(await refusalOf(() => open(aegisOf(), token))).toMatchSnapshot();
      });
    });
  });

  describe.each(["the domain header", "the raw buckets"] as const)(
    "a COSE_Sign1 typed application/cwt reports a byte-string IV in %s",
    (reported) => {
      test.each(["protected", "unprotected"] as const)(
        "as base64url when it rides the %s bucket",
        async (bucket) => {
          const token = (
            bucket === "protected"
              ? signed(TEST_EC_KEY_SIG, "application/cwt", CLAIMS, [[IV, BYTES]])
              : withUnprotectedIv(
                  signed(TEST_EC_KEY_SIG, "application/cwt", CLAIMS),
                  BYTES,
                )
          ).toString("base64url");

          const result =
            reported === "the domain header"
              ? (await aegis.verify(token)).header.initialisationVector
              : await aegis.cwt
                  .verify(token)
                  .then(({ protectedHeader, unprotectedHeader }) => ({
                    protected: protectedHeader.iv,
                    unprotected: unprotectedHeader.iv,
                  }));

          expect(result).toMatchSnapshot();
        },
      );
    },
  );

  describe("a COSE_Encrypt0", () => {
    describe.each(SEALED_DOORS)("at %s", (_door, open) => {
      test("accepts the token with its nonce a byte string", async () => {
        await expect(open(aegis, sealed().toString("base64url"))).resolves.toBeDefined();
      });

      test.each(NOT_BYTES)(
        "refuses a protected IV that is %s beside a byte-string unprotected one",
        async (_shape, iv) => {
          const token = sealed([[IV, iv]]).toString("base64url");

          expect(await refusalOf(() => open(aegis, token))).toMatchSnapshot();
        },
      );

      test.each(NOT_BYTES)(
        "refuses an unprotected IV that is %s in place of the nonce",
        async (_shape, iv) => {
          const token = withUnprotectedIv(sealed(), iv).toString("base64url");

          expect(await refusalOf(() => open(aegis, token))).toMatchSnapshot();
        },
      );
    });
  });

  test("a caller's IV is refused by name at the COSE encrypt door, before any value reaches the wire", async () => {
    expect(
      await refusalOf(() =>
        aegis.cwe.encrypt(Buffer.from("content"), { header: { iv: BYTES } } as never),
      ),
    ).toMatchSnapshot();
  });
});
