import { Amphora } from "@lindorm/amphora";
import { EcError } from "@lindorm/ec";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { KRYPTOS_EC_SIG_ES256, KRYPTOS_EC_SIG_ES384 } from "@lindorm/kryptos/fixtures";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { alterToken } from "../../__fixtures__/altered-token.js";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { spliceCoseSlot } from "../../__fixtures__/splice-cose-slot.js";
import { Aegis } from "../../classes/Aegis.js";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { AegisError, CwsError } from "../../errors/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";

const vaulted = (kryptos: IKryptos): IKryptos =>
  KryptosKit.clone(kryptos, {
    issuer: ISSUER,
    notBefore: new Date("2023-01-01T01:00:00.000Z"),
    expiresAt: new Date("2024-06-01T00:00:00.000Z"),
    publish: true,
  });

// The raw lengths are RFC 9053 §2.1's, spelled here rather than read off the code
// that converts them, so a row states the wire and not the implementation.
const CURVES: ReadonlyArray<[curve: string, kryptos: IKryptos, rawLength: number]> = [
  ["P-256", vaulted(KRYPTOS_EC_SIG_ES256), 64],
  ["P-384", vaulted(KRYPTOS_EC_SIG_ES384), 96],
  ["P-521", TEST_EC_KEY_SIG, 132],
];

type Door = [
  door: string,
  mint: (aegis: Aegis) => Promise<string>,
  open: (aegis: Aegis, token: string) => Promise<unknown>,
];

const mintCwt = async (aegis: Aegis): Promise<string> =>
  (
    await aegis.cwt.sign({
      iss: ISSUER,
      sub: "user-1",
      aud: ["https://rs.lindorm.io/"],
      exp: 1704099600,
    })
  ).token;

const mintCws = async (aegis: Aegis): Promise<string> =>
  (await aegis.cws.sign("the content bytes")).token;

const DOORS: ReadonlyArray<Door> = [
  ["aegis.verify, a CWT", mintCwt, (aegis, token) => aegis.verify(token)],
  ["aegis.cwt.verify", mintCwt, (aegis, token) => aegis.cwt.verify(token)],
  ["aegis.verify, a CWS", mintCws, (aegis, token) => aegis.verify(token)],
  ["aegis.cws.verify", mintCws, (aegis, token) => aegis.cws.verify(token)],
];

const withSignature = (token: string, signature: Buffer): string =>
  spliceCoseSlot(Buffer.from(token, "base64url"), 3, signature).toString("base64url");

const deployment = async (kryptos: IKryptos): Promise<Aegis> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(kryptos);

  return new Aegis({ amphora, logger });
};

const refusalOf = async (open: () => Promise<unknown>): Promise<unknown> => {
  try {
    await open();
  } catch (error) {
    return error;
  }

  return undefined;
};

/**
 * Refusing the token is RFC 9053 §2.1 on verify; answering it as the structural
 * `cose_malformed` rather than the signature verdict is AEGIS POLICY. Each door
 * also accepts the token as minted and answers a right-length signature that does
 * not verify under the signature verdict, so a refusal below is the length's.
 */
describe("a COSE_Sign1 whose EC signature is not the curve's raw length", () => {
  describe.each(CURVES)("under a %s key", (_curve, kryptos, rawLength) => {
    let aegis: Aegis;

    beforeAll(async () => {
      aegis = await deployment(kryptos);
    });

    describe.each(DOORS)("at %s", (_door, mint, open) => {
      let token: string;

      beforeAll(async () => {
        token = await mint(aegis);
      });

      test("accepts the token as minted", async () => {
        await expect(open(aegis, token)).resolves.toBeDefined();
      });

      test.each([0, 2, rawLength - 1, rawLength + 1])(
        "refuses a %i-byte signature as a COSE structural fault",
        async (length) => {
          const thrown = await refusalOf(() =>
            open(aegis, withSignature(token, Buffer.alloc(length, 1))),
          );

          expect(thrown).toBeInstanceOf(AegisError);
          expect(thrown).toBeInstanceOf(CwsError);
          expect((thrown as CwsError).code).toBe("cose_malformed");
          expect((thrown as CwsError).data).toEqual({});
          expect((thrown as CwsError).debug).toEqual({
            actual: length,
            expected: rawLength,
          });
        },
      );

      test("answers a right-length signature that does not verify under the signature verdict", async () => {
        const thrown = await refusalOf(() => open(aegis, alterToken(token, "signature")));

        expect(thrown).toBeInstanceOf(CwsError);
        expect((thrown as CwsError).code).toBe("cose_signature_invalid");
      });
    });
  });
});

describe("the signature cycle re-labels only @lindorm/ec's raw-length refusal", () => {
  let aegis: Aegis;

  beforeAll(async () => {
    aegis = await deployment(TEST_EC_KEY_SIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(DOORS)("at %s", (_door, mint, open) => {
    let token: string;

    beforeAll(async () => {
      token = await mint(aegis);
    });

    test.each([
      [
        "an EcError of any other code",
        () => new EcError("Invalid signature", { code: "invalid_signature" }),
      ],
      [
        "a fault outside @lindorm/ec carrying the raw-length code",
        () => new AegisError("Fault", { code: "invalid_raw_signature_length" }),
      ],
    ])("passes %s through as raised", async (_fault, raise) => {
      const fault = raise();

      vi.spyOn(SignatureKit.prototype, "verify").mockImplementation(() => {
        throw fault;
      });

      expect(await refusalOf(() => open(aegis, token))).toBe(fault);
    });
  });
});
