import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { signAsThirdParty } from "../__fixtures__/third-party-producer.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT EVERY PUBLIC DOOR DOES WITH A CONFIRMATION, ROW BY ROW.
 *
 * Each row records the OUTCOME the door produced — the raw `cnf` on the wire, the
 * domain confirmation a read returned, or the refusal `{ name, code, data }` — and
 * the snapshot is that record. The table exists so a change to how `cnf` is
 * declared can be held byte-for-byte against what the doors did before it: a row
 * that moves is a wire-observable change, named by its door and its input.
 *
 * ⛔ THE WIRE IS READ THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts`), and a foreign COSE confirmation is written by
 * the third-party producer (`__fixtures__/third-party-producer.ts`), so no row
 * reads aegis's own decoder to describe aegis's own writer.
 *
 * ⚠ A JOSE `cnf` is recorded as its JSON TEXT, because member order is part of the
 * signed bytes and a pretty-printed object sorts its keys.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const AUDIENCE = "https://rs.lindorm.test";

/** A real 32-byte SHA-256 digest, base64url-encoded (RFC 7638 / RFC 9449 §6.1). */
const JKT = "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I";
const OTHER_JKT = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE";
const X5T = "A4DtL2JmUMhAsvJj5tKyn64SqzmuXbMrJa0n761y5v0";
const KID = "cnf-outcome-key-id";
const JKU = "https://rs.lindorm.test/.well-known/jwks.json";

/** The confirmed key as a JWK: a P-256 public key, so the COSE_Key form carries every label. */
const CNF_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
  y: "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
};

/** The same key as a COSE_Key map (RFC 9052 §7): kty 2 (EC2), crv 1 (P-256), x, y. */
const CNF_COSE_KEY = new Map<number, unknown>([
  [1, 2],
  [-1, 1],
  [-2, Buffer.from(CNF_JWK.x, "base64url")],
  [-3, Buffer.from(CNF_JWK.y, "base64url")],
]);

/** RFC 8747 §7.1.1: the CWT claim key of `cnf`. */
const CNF_COSE_CLAIM_LABEL = 8;

/** The instant the clock reads, as a NumericDate. */
const NOW = Math.floor(new Date("2024-01-01T08:00:00.000Z").getTime() / 1000);

const logger = createMockLogger();

let aegis: Aegis;

beforeAll(async () => {
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  aegis = new Aegis({ amphora, logger });
});

type Outcome =
  | { ok: unknown }
  | { refused: { name: string; code: unknown; data: unknown } };

/** What a door did: the value it produced, or the refusal it raised. */
const outcomeOf = async (act: () => unknown): Promise<Outcome> => {
  try {
    return { ok: await act() };
  } catch (error) {
    const { name, code, data } = error as {
      name: string;
      code?: unknown;
      data?: unknown;
    };

    return { refused: { name, code, data } };
  }
};

/** The raw `cnf` a token carries, in the wire's own vocabulary. */
const rawCnfOf = (token: string): Dict => {
  const inspection = inspectToken(token);

  if (inspection.payload.readable === false) {
    throw new Error(`the payload cannot be read: ${inspection.payload.reason}`);
  }

  return inspection.wire === "jose"
    ? { jose: JSON.stringify(inspection.payload.value.cnf) }
    : { cose: inspection.payload.value.get(CNF_COSE_CLAIM_LABEL) };
};

/** The three mint doors a confirmation reaches: each wire, and the COSE wire in its proprietary encoding. */
type MintDoor = "jose" | "cose" | "cose(p)";

const MINT_DOOR = {
  jose: { format: "jwt", proprietary: undefined },
  cose: { format: "cwt", proprietary: undefined },
  "cose(p)": { format: "cwt", proprietary: true },
} as const satisfies Record<
  MintDoor,
  { format: "jwt" | "cwt"; proprietary: true | undefined }
>;

const BOTH_WIRES: ReadonlyArray<MintDoor> = ["jose", "cose"];

const mint = async (door: MintDoor, confirmation: unknown): Promise<Dict> => {
  const { format, proprietary } = MINT_DOOR[door];

  const signed = await aegis.mint(
    "default",
    { subject: "user-1", expires: "1h", confirmation } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "cnf-outcome-1" },
    },
  );

  return rawCnfOf(signed.token);
};

const MINT_ROWS: ReadonlyArray<
  [row: string, confirmation: unknown, doors: ReadonlyArray<MintDoor>]
> = [
  ["1: { keyId }", { keyId: KID }, ["jose", "cose", "cose(p)"]],
  ["2: { key: JWK }", { key: CNF_JWK }, ["jose", "cose", "cose(p)"]],
  ["3: { key, keyId }", { key: CNF_JWK, keyId: KID }, BOTH_WIRES],
  [
    "4: { keyId, thumbprint, jwkSetUri, mtlsCertThumbprint, key }",
    {
      keyId: KID,
      thumbprint: JKT,
      jwkSetUri: JKU,
      mtlsCertThumbprint: X5T,
      key: CNF_JWK,
    },
    BOTH_WIRES,
  ],
  ['5: { keyId, tlsClientAuth: "x" }', { keyId: KID, tlsClientAuth: "x" }, BOTH_WIRES],
  ["6: { thumbprint, someExt: null }", { thumbprint: JKT, someExt: null }, ["jose"]],
  ["7: { key: { ...JWK, ext: null } }", { key: { ...CNF_JWK, ext: null } }, ["jose"]],
  ['8: { jkt: "abc" }', { jkt: "abc" }, BOTH_WIRES],
  ['8: { kid: "k2" }', { kid: "k2" }, BOTH_WIRES],
  ["8: { thumbprint, jkt: other }", { thumbprint: JKT, jkt: OTHER_JKT }, BOTH_WIRES],
  ["9: { thumbprint: null, keyId }", { thumbprint: null, keyId: KID }, BOTH_WIRES],
  ["9: { thumbprint: null }", { thumbprint: null }, BOTH_WIRES],
  ["10: { thumbprint: 42 }", { thumbprint: 42 }, BOTH_WIRES],
  ['10: { key: "not-a-jwk" }', { key: "not-a-jwk" }, BOTH_WIRES],
  ["10: { keyId: 42 }", { keyId: 42 }, BOTH_WIRES],
  ["11: {}", {}, BOTH_WIRES],
  ["11: { keyId: undefined }", { keyId: undefined }, BOTH_WIRES],
  ['12: { thumbprint: "" }', { thumbprint: "" }, BOTH_WIRES],
  ['12: { mtlsCertThumbprint: "" }', { mtlsCertThumbprint: "" }, BOTH_WIRES],
  ["12: { key: {} }", { key: {} }, BOTH_WIRES],
  ['12: { keyId: "" }', { keyId: "" }, BOTH_WIRES],
  ['12: { jwkSetUri: "" }', { jwkSetUri: "" }, BOTH_WIRES],
  ['12: { thumbprint: "", keyId: "k1" }', { thumbprint: "", keyId: "k1" }, BOTH_WIRES],
  [
    '12: { mtlsCertThumbprint: "", keyId: "k1" }',
    { mtlsCertThumbprint: "", keyId: "k1" },
    BOTH_WIRES,
  ],
  ['12: { key: {}, keyId: "k1" }', { key: {}, keyId: "k1" }, BOTH_WIRES],
  ['12: { keyId: "", key: JWK }', { keyId: "", key: CNF_JWK }, BOTH_WIRES],
  ['12: { jwkSetUri: "", keyId: "k1" }', { jwkSetUri: "", keyId: "k1" }, BOTH_WIRES],
  ['13: "not-an-object"', "not-an-object", BOTH_WIRES],
];

const MINT_CASES = MINT_ROWS.flatMap(([row, confirmation, doors]) =>
  doors.map((door) => [`${row} on ${door}`, confirmation, door] as const),
);

/** The wire claims a raw claims door signs, spelled for its wire. */
const rawClaims = (wire: Wire, cnf: unknown): Dict => ({
  iss: ISSUER,
  sub: "user-1",
  aud: [AUDIENCE],
  [wire === "jose" ? "jti" : "cti"]: "cnf-outcome-raw-1",
  iat: NOW,
  exp: NOW + 120,
  cnf,
});

const rawSign = (wire: Wire, cnf: unknown): Promise<{ token: string }> =>
  wire === "jose"
    ? aegis.jwt.sign(rawClaims(wire, cnf) as never, { tokenType: "access" })
    : aegis.cwt.sign(rawClaims(wire, cnf) as never, { tokenType: "access" });

/** The media type a third party stamps on each wire's claims token, so a verify reaches the confirmation. */
const FOREIGN_TYP = { jose: "JWT", cose: "application/cwt" } as const satisfies Record<
  Wire,
  string
>;

/** A claims token a third party signed over the vault's key, carrying `cnf` as given. */
const foreign = (wire: Wire, cnf: unknown): Promise<string> =>
  signAsThirdParty(
    wire,
    { iss: ISSUER, sub: "user-1", iat: NOW, exp: NOW + 120, cnf },
    FOREIGN_TYP[wire],
    TEST_EC_KEY_SIG,
  );

/** The domain confirmation a read produced, as JSON text so member order is recorded. */
const domainCnfOf = (claims: Dict): Dict => ({
  confirmation: JSON.stringify(claims.confirmation),
});

describe("the confirmation claim's outcome at every public door", () => {
  describe("aegis.mint", () => {
    test.each(MINT_CASES)("%s", async (_name, confirmation, door) => {
      expect(await outcomeOf(() => mint(door, confirmation))).toMatchSnapshot();
    });
  });

  describe("aegis.cwt.sign", () => {
    test.each([
      ["14: { jwk, kid: 42 }", { jwk: CNF_JWK, kid: 42 }],
      ["14: { jkt }", { jkt: JKT }],
      ['14: { kid: "" }', { kid: "" }],
      ['14: { ckt: "x" }', { ckt: "x" }],
    ])("%s", async (_name, cnf) => {
      expect(
        await outcomeOf(async () => rawCnfOf((await rawSign("cose", cnf)).token)),
      ).toMatchSnapshot();
    });
  });

  describe("Aegis.toWire", () => {
    test.each([
      ['15: { keyId: "" }', { keyId: "" }],
      ["15: { thumbprint, keyId }", { thumbprint: JKT, keyId: KID }],
    ])("%s", async (_name, confirmation) => {
      expect(
        await outcomeOf(() => JSON.stringify(Aegis.toWire({ confirmation } as Dict))),
      ).toMatchSnapshot();
    });
  });

  describe("Aegis.toDomain", () => {
    test.each([
      [
        "16: all five members and a null tail",
        { jkt: JKT, "x5t#S256": X5T, jwk: CNF_JWK, kid: KID, jku: JKU, someExt: null },
      ],
      ['16: { thumbprint: "abc" }', { thumbprint: "abc" }],
      ["16: { jkt: 42 }", { jkt: 42 }],
      ["16: { jkt: null }", { jkt: null }],
      ['16: { kid: "" }', { kid: "" }],
    ])("%s", async (_name, cnf) => {
      expect(
        await outcomeOf(() =>
          domainCnfOf(Aegis.toDomain({ cnf } as Dict).claims as Dict),
        ),
      ).toMatchSnapshot();
    });
  });

  describe("aegis.parse of a third party's COSE confirmation", () => {
    test.each([
      [
        "17: Map { 1: COSE_Key, 3: h'6b' }",
        new Map<number | string, unknown>([
          [1, CNF_COSE_KEY],
          [3, Buffer.from("k", "utf8")],
        ]),
      ],
      [
        '17: Map { 3: h\'6b\', 99: "x", "jkt": "y" }',
        new Map<number | string, unknown>([
          [3, Buffer.from("k", "utf8")],
          [99, "x"],
          ["jkt", "y"],
        ]),
      ],
      [
        '17: Map { 1: COSE_Key, "jwk": JWK }',
        new Map<number | string, unknown>([
          [1, CNF_COSE_KEY],
          ["jwk", CNF_JWK],
        ]),
      ],
      ['17: Map { 3: "text" }', new Map<number | string, unknown>([[3, "text"]])],
      ["17: Map { 3: h'' }", new Map<number | string, unknown>([[3, Buffer.alloc(0)]])],
    ])("%s", async (_name, cnf) => {
      expect(
        await outcomeOf(async () =>
          domainCnfOf(aegis.parse(await foreign("cose", cnf)).claims as Dict),
        ),
      ).toMatchSnapshot();
    });
  });

  describe("aegis.verify", () => {
    test.each([
      ['18: raw-signed { kid: "" } on jose', "jose", { kid: "" }],
      ['18: raw-signed { kid: "" } on cose', "cose", { kid: "" }],
      ["18: raw-signed {} on jose", "jose", {}],
      ["18: raw-signed {} on cose", "cose", {}],
    ] as const)("%s", async (_name, wire, cnf) => {
      expect(
        await outcomeOf(async () =>
          domainCnfOf((await aegis.verify((await rawSign(wire, cnf)).token)).claims),
        ),
      ).toMatchSnapshot();
    });

    test.each([
      ["18: third-party {} on jose", "jose", {}],
      ["18: third-party Map {} on cose", "cose", new Map<number, unknown>()],
    ] as const)("%s", async (_name, wire, cnf) => {
      expect(
        await outcomeOf(async () =>
          domainCnfOf((await aegis.verify(await foreign(wire, cnf))).claims),
        ),
      ).toMatchSnapshot();
    });
  });
});
