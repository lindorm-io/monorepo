import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { craftJwe } from "../__fixtures__/craft-jwe.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";

const logger = createMockLogger();

const vaultResident = { encryption: "A256GCM", issuer: ISSUER, publish: true } as const;

const GCMKW = KryptosKit.generate.enc.oct({ ...vaultResident, algorithm: "A256GCMKW" });
const ECDH_GCMKW = KryptosKit.generate.enc.ec({
  ...vaultResident,
  algorithm: "ECDH-ES+A256GCMKW",
});
const PBES2 = KryptosKit.generate.enc.oct({
  ...vaultResident,
  algorithm: "PBES2-HS512+A256KW",
});
const KW = KryptosKit.generate.enc.oct({ ...vaultResident, algorithm: "A256KW" });

const IV = Buffer.alloc(12).toString("base64url");
const TAG = Buffer.alloc(16).toString("base64url");
const SALT = Buffer.alloc(16).toString("base64url");

/** The header a JWE to `kryptos` carries before the parameter a row states. */
const envelope = (kryptos: IKryptos): Dict => ({
  typ: "JWE",
  alg: kryptos.algorithm,
  enc: "A256GCM",
  kid: kryptos.id,
});

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

type Row = [name: string, kryptos: IKryptos, header: Dict];

/** Each header a key-management algorithm consumes, stated as something other than base64url. */
const REFUSED: ReadonlyArray<Row> = [
  ["an A256GCMKW token whose iv is the number 5", GCMKW, { iv: 5, tag: TAG }],
  ["an A256GCMKW token whose iv is true", GCMKW, { iv: true, tag: TAG }],
  ["an A256GCMKW token whose iv is an object", GCMKW, { iv: { iv: IV }, tag: TAG }],
  ["an A256GCMKW token whose iv is an array", GCMKW, { iv: [IV], tag: TAG }],
  ["an A256GCMKW token whose iv is the number 0", GCMKW, { iv: 0, tag: TAG }],
  ["an A256GCMKW token whose iv is false", GCMKW, { iv: false, tag: TAG }],
  ["an A256GCMKW token whose iv is null", GCMKW, { iv: null, tag: TAG }],
  ["an A256GCMKW token whose iv is absent", GCMKW, { tag: TAG }],
  ["an A256GCMKW token whose iv is not base64url", GCMKW, { iv: "!!!", tag: TAG }],
  ["an A256GCMKW token whose iv is padded", GCMKW, { iv: `${IV}AA==`, tag: TAG }],
  [
    "an A256GCMKW token whose iv carries a plus sign, which only the standard alphabet has",
    GCMKW,
    { iv: "AA+AAAAAAAAAAAAA", tag: TAG },
  ],
  [
    "an A256GCMKW token whose iv carries a slash, which only the standard alphabet has",
    GCMKW,
    { iv: "AA/AAAAAAAAAAAAA", tag: TAG },
  ],
  [
    "an A256GCMKW token whose iv carries whitespace",
    GCMKW,
    { iv: "AAAA AAAA AAAA AAAA", tag: TAG },
  ],
  [
    "an A256GCMKW token whose iv is a length no octets encode to",
    GCMKW,
    { iv: `${IV}A`, tag: TAG },
  ],
  ["an A256GCMKW token whose tag is the number 5", GCMKW, { iv: IV, tag: 5 }],
  ["an A256GCMKW token whose tag is null", GCMKW, { iv: IV, tag: null }],
  ["an A256GCMKW token whose tag is absent", GCMKW, { iv: IV }],
  ["an A256GCMKW token whose tag is not base64url", GCMKW, { iv: IV, tag: "!!!" }],
  [
    "an ECDH-ES+A256GCMKW token whose iv is the number 5",
    ECDH_GCMKW,
    { iv: 5, tag: TAG },
  ],
  ["an ECDH-ES+A256GCMKW token whose tag is absent", ECDH_GCMKW, { iv: IV }],
  ["a PBES2 token whose p2s is the number 5", PBES2, { p2s: 5, p2c: 1000 }],
  ["a PBES2 token whose p2s is the number 0", PBES2, { p2s: 0, p2c: 1000 }],
  ["a PBES2 token whose p2s is false", PBES2, { p2s: false, p2c: 1000 }],
  ["a PBES2 token whose p2s is null", PBES2, { p2s: null, p2c: 1000 }],
  ["a PBES2 token whose p2s is absent", PBES2, { p2c: 1000 }],
  ["a PBES2 token whose p2s is not base64url", PBES2, { p2s: "!!!", p2c: 1000 }],
];

/**
 * A header the algorithm does not consume, or one it consumes stated as
 * base64url: the header read refuses none of them, so the key unwrap or the AEAD
 * answers for the junk body.
 */
const LEFT_TO_THE_DECRYPTION: ReadonlyArray<Row> = [
  ["the iv of an A256KW token that is the number 5", KW, { iv: 5 }],
  ["the iv of an A256KW token that is not base64url", KW, { iv: "!!!" }],
  ["the tag of an A256KW token that is the number 5", KW, { tag: 5 }],
  ["the p2s of an A256KW token that is the number 5", KW, { p2s: 5 }],
  [
    "the iv of a PBES2 token that is the number 5",
    PBES2,
    { iv: 5, p2s: SALT, p2c: 1000 },
  ],
  [
    "the p2s of an A256GCMKW token that is the number 5",
    GCMKW,
    { iv: IV, tag: TAG, p2s: 5 },
  ],
  ["the zero-octet iv of an A256GCMKW token", GCMKW, { iv: "", tag: TAG }],
];

describe("a JWE header parameter the key-management algorithm consumes", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const amphora: IAmphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    await amphora.setup();

    for (const kryptos of [TEST_EC_KEY_SIG, GCMKW, ECDH_GCMKW, PBES2, KW]) {
      amphora.add(kryptos);
    }

    aegis = new Aegis({ amphora, logger });
  });

  const DOORS: ReadonlyArray<
    [door: string, open: (kryptos: IKryptos, token: string) => Promise<unknown>]
  > = [
    [
      "JweKit.decrypt",
      async (kryptos, token) => new JweKit({ kryptos, logger }).decrypt(token),
    ],
    ["aegis.jwe.decrypt", (_kryptos, token) => aegis.jwe.decrypt(token)],
    ["aegis.decrypt", (_kryptos, token) => aegis.decrypt(token)],
    ["aegis.verify", (_kryptos, token) => aegis.verify(token)],
  ];

  describe.each(DOORS)("at %s", (_door, open) => {
    test.each(REFUSED)("refuses %s", async (_name, kryptos, header) => {
      expect(
        await refusalOf(() =>
          open(kryptos, craftJwe({ ...envelope(kryptos), ...header })),
        ),
      ).toMatchSnapshot();
    });

    test.each(LEFT_TO_THE_DECRYPTION)(
      "leaves %s to the key unwrap and the AEAD",
      async (_name, kryptos, header) => {
        expect(
          await refusalOf(() =>
            open(kryptos, craftJwe({ ...envelope(kryptos), ...header })),
          ),
        ).toMatchSnapshot();
      },
    );
  });

  test("a kit holding a key no key-management algorithm names refuses the token by that algorithm", async () => {
    const kit = new JweKit({ kryptos: TEST_EC_KEY_SIG, logger });

    expect(
      await refusalOf(async () =>
        kit.decrypt(craftJwe({ ...envelope(TEST_EC_KEY_SIG), iv: IV, tag: TAG })),
      ),
    ).toMatchSnapshot();
  });
});
