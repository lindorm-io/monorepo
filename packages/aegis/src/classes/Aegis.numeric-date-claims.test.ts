import type { Dict } from "@lindorm/types";
import { CompactSign, importJWK } from "jose";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { foreignSignedCose } from "../__fixtures__/foreign-signed-cose.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import {
  createTestDeployment,
  DEFAULT_CLOCK,
  ISSUER,
  NOW,
  type TestDeployment,
} from "../__fixtures__/test-deployment.js";
import {
  AegisDomainError,
  type AegisError,
  CoseError,
  JwtError,
} from "../errors/index.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  coseLabel,
  coseName,
  joseName,
} from "../internal/claims/claims-registry.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { encodeCbor, Tag } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { codecFor } from "../internal/registry/param-spec.js";
import type { Wire } from "../internal/registry/wire.js";
import { Aegis } from "./Aegis.js";
import { CwmKit } from "./CwmKit.js";
import { CwtKit } from "./CwtKit.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * A NumericDate claim holds a number of seconds since the epoch and nothing else
 * (RFC 7519 §2, RFC 8392 §2): a stated value of any other type is refused with an
 * `AegisError` carrying a code, at every door on both wires, and never reaches a
 * matcher or a domain field as anything but a valid `Date`.
 *
 * The claims are the registry's `date` codec, per wire. Each wire's tokens are
 * hand-built over a claims set this file writes, so a value aegis's own writers
 * refuse to produce — `1e999`, a CBOR tag, a byte string — reaches the reader.
 */

const numericDateSpecs = (wire: Wire): ReadonlyArray<ClaimSpec> =>
  CLAIM_SPECS.filter((spec) => codecFor(spec, wire).kind === "date");

/** Where a domain read files the claim: `claims`, or `profile` for a profile claim. */
const domainValue = (
  result: { claims: Dict; profile?: Dict },
  spec: ClaimSpec,
): unknown => result.claims[spec.domain] ?? result.profile?.[spec.domain];

/** The range checks a control row stands down, so `0` and a past fraction read rather than expire. */
const RANGE_WAIVED = {
  verifyExpiration: false,
  verifyNotBefore: false,
  verifyIssuedAt: false,
  verifyAuthTime: false,
} as const;

/** The accepted controls: a non-integer NumericDate (RFC 7519 §2), the epoch itself, and the last instant a `Date` holds. */
const ACCEPTED: ReadonlyArray<[name: string, value: number]> = [
  ["a fractional 1700000000.5", 1700000000.5],
  ["0, the epoch", 0],
  ["the last instant a Date holds", 8640000000000],
];

const refusalOf = async (act: () => unknown): Promise<unknown> => {
  try {
    await act();
  } catch (error) {
    return error;
  }

  throw new Error("the door accepted the token");
};

// --- JOSE --------------------------------------------------------------------

/**
 * The values a JSON payload can carry that are not a NumericDate, spelled as the
 * payload TEXT: `1e999` is a JSON number (RFC 8259 §6) that reads as `Infinity`.
 */
const JOSE_REFUSED: ReadonlyArray<[name: string, json: string]> = [
  ["a numeric string", '"1700000000"'],
  ["an ISO date string", '"2023-11-14T22:13:20Z"'],
  ["true", "true"],
  ["false", "false"],
  ["an empty string", '""'],
  ["an empty array", "[]"],
  ["an object", "{}"],
  ["Infinity", "1e999"],
  ["-Infinity", "-1e999"],
  ["1e300, outside the Date range", "1e300"],
  ["one second past the last Date", "8640000000001"],
];

const JOSE_BASE: Dict = {
  iss: ISSUER,
  sub: "user-1",
  exp: NOW + 3600,
  iat: NOW - 60,
  jti: "token-1",
};

/** The base claims set without the claim, then the claim as raw JSON text. */
const josePayload = (spec: ClaimSpec, json: string): string => {
  const { [joseName(spec)]: _omitted, ...base } = JOSE_BASE;

  return `${JSON.stringify(base).slice(0, -1)},${JSON.stringify(joseName(spec))}:${json}}`;
};

const joseToken = async (payload: string): Promise<string> =>
  new CompactSign(Buffer.from(payload, "utf8"))
    .setProtectedHeader({
      alg: TEST_EC_KEY_SIG.algorithm,
      kid: TEST_EC_KEY_SIG.id,
      typ: "JWT",
    })
    .sign(
      await importJWK(TEST_EC_KEY_SIG.export("jwk") as never, TEST_EC_KEY_SIG.algorithm),
    );

type JoseDoor = [door: string, open: (aegis: Aegis, token: string) => unknown];

const JOSE_DOORS: ReadonlyArray<JoseDoor> = [
  ["aegis.parse", (aegis, token) => aegis.parse(token)],
  ["aegis.verify", (aegis, token) => aegis.verify(token)],
  ["aegis.jwt.verify", (aegis, token) => aegis.jwt.verify(token)],
];

const JOSE_REFUSED_ROWS: ReadonlyArray<
  [label: string, spec: ClaimSpec, json: string, open: JoseDoor[1]]
> = numericDateSpecs("jose").flatMap((spec) =>
  JOSE_REFUSED.flatMap(([name, json]) =>
    JOSE_DOORS.map(([door, open]): [string, ClaimSpec, string, JoseDoor[1]] => [
      `jose: ${joseName(spec)} holding ${name} is refused at ${door}`,
      spec,
      json,
      open,
    ]),
  ),
);

const JOSE_ACCEPTED_ROWS: ReadonlyArray<[label: string, spec: ClaimSpec, value: number]> =
  numericDateSpecs("jose").flatMap((spec) =>
    ACCEPTED.map(([name, value]): [string, ClaimSpec, number] => [
      `jose: ${joseName(spec)} holding ${name}`,
      spec,
      value,
    ]),
  );

// --- COSE --------------------------------------------------------------------

/** The values a CBOR claims map can carry that are not a NumericDate (RFC 8392 §2). */
const COSE_REFUSED: ReadonlyArray<[name: string, value: unknown]> = [
  ["a numeric text string", "1700000000"],
  ["an ISO date text string", "2023-11-14T22:13:20Z"],
  ["true", true],
  ["false", false],
  ["an empty text string", ""],
  ["an empty array", []],
  ["a map", new Map([[1, 2]])],
  ["a byte string", Buffer.from("1700000000", "utf8")],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
  ["a 64-bit integer read as a bigint", 2n ** 64n - 1n],
  ["a bignum", 2n ** 70n],
  ["1e300, outside the Date range", 1e300],
  ["one second past the last Date", 8640000000001],
  ["a tag-1 epoch date", new Date(1700000000 * 1000)],
  ["a tag-0 date-time string", new Tag(0, "2023-11-14T22:13:20Z")],
];

const COSE_BASE: ReadonlyArray<[number, unknown]> = [
  [1, ISSUER],
  [2, "user-1"],
  [4, NOW + 3600],
  [6, NOW - 60],
  [7, Buffer.from("token-1", "utf8")],
];

/** Every key a NumericDate claim can be stated under: its integer label and its text name. */
const keyFormsOf = (spec: ClaimSpec): ReadonlyArray<CoseLabel> => {
  const label = coseLabel(spec);

  return label === undefined ? [coseName(spec)] : [label, coseName(spec)];
};

/** The base claims set without the claim under any key, then the claim at `key`. */
const cosePayload = (spec: ClaimSpec, key: CoseLabel, value: unknown): Buffer => {
  const claims = new Map<CoseLabel, unknown>(
    COSE_BASE.filter(([label]) => label !== coseLabel(spec)),
  );

  claims.set(key, value);

  return encodeCbor(claims);
};

const coseToken = (kryptos: typeof TEST_EC_KEY_SIG, payload: Buffer): Buffer =>
  foreignSignedCose(
    kryptos,
    new Map<CoseLabel, unknown>([[coseByJose("alg"), algToCoseLabel(kryptos.algorithm)]]),
    payload,
  );

type CoseDoor = [
  door: string,
  kryptos: typeof TEST_EC_KEY_SIG,
  open: (aegis: Aegis, token: Buffer) => unknown,
];

const COSE_DOORS: ReadonlyArray<CoseDoor> = [
  [
    "aegis.parse",
    TEST_EC_KEY_SIG,
    (aegis, token) => aegis.parse(token.toString("base64url")),
  ],
  [
    "aegis.verify",
    TEST_EC_KEY_SIG,
    (aegis, token) => aegis.verify(token.toString("base64url")),
  ],
  [
    "aegis.cwt.verify",
    TEST_EC_KEY_SIG,
    (aegis, token) => aegis.cwt.verify(token.toString("base64url")),
  ],
  [
    "aegis.cwm.verify",
    TEST_OCT_KEY_SIG,
    (aegis, token) => aegis.cwm.verify(token.toString("base64url")),
  ],
  ["CwtKit.decode", TEST_EC_KEY_SIG, (_aegis, token) => CwtKit.decode(token)],
  ["CwmKit.decode", TEST_OCT_KEY_SIG, (_aegis, token) => CwmKit.decode(token)],
];

const COSE_REFUSED_ROWS: ReadonlyArray<
  [label: string, spec: ClaimSpec, key: CoseLabel, value: unknown, door: CoseDoor]
> = numericDateSpecs("cose").flatMap((spec) =>
  keyFormsOf(spec).flatMap((key) =>
    COSE_REFUSED.flatMap(([name, value]) =>
      COSE_DOORS.map((door): [string, ClaimSpec, CoseLabel, unknown, CoseDoor] => [
        `cose: ${coseName(spec)} at ${JSON.stringify(key)} holding ${name} is refused at ${door[0]}`,
        spec,
        key,
        value,
        door,
      ]),
    ),
  ),
);

const COSE_ACCEPTED_ROWS: ReadonlyArray<[label: string, spec: ClaimSpec, value: number]> =
  numericDateSpecs("cose").flatMap((spec) =>
    ACCEPTED.map(([name, value]): [string, ClaimSpec, number] => [
      `cose: ${coseName(spec)} at its label holding ${name}`,
      spec,
      value,
    ]),
  );

// --- Aegis.toDomain -----------------------------------------------------------

/** What a caller's dict can hold at a NumericDate key that is neither one nor a valid `Date`. */
const DICT_REFUSED: ReadonlyArray<[name: string, value: unknown]> = [
  ["a numeric string", "1700000000"],
  ["an ISO date string", "2023-11-14T22:13:20Z"],
  ["true", true],
  ["false", false],
  ["an empty string", ""],
  ["an empty array", []],
  ["an object", {}],
  ["a Map", new Map()],
  ["a byte string", Buffer.from("1700000000", "utf8")],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
  ["a bigint", 1700000000n],
  ["1e300, outside the Date range", 1e300],
  ["one second past the last Date", 8640000000001],
  ["an Invalid Date", new Date(NaN)],
];

const DICT_ACCEPTED: ReadonlyArray<[name: string, value: unknown, read: Date]> = [
  ["a valid Date", new Date(1700000000 * 1000), new Date(1700000000 * 1000)],
  ["a fractional 1700000000.5", 1700000000.5, new Date(1700000000500)],
  ["0, the epoch", 0, new Date(0)],
  ["the last instant a Date holds", 8640000000000, new Date(8640000000000000)],
];

describe("Aegis — a NumericDate claim holds a number", () => {
  let ctx: TestDeployment;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createTestDeployment();
    ctx.amphora.add(TEST_OCT_KEY_SIG);
  });

  test("should derive a NumericDate claim set on each wire", () => {
    expect(numericDateSpecs("jose").length).toBeGreaterThan(0);
    expect(numericDateSpecs("cose").map((spec) => spec.domain)).toEqual(
      numericDateSpecs("jose").map((spec) => spec.domain),
    );
  });

  describe("jose", () => {
    test.each(JOSE_REFUSED_ROWS)("%s", async (_label, spec, json, open) => {
      const token = await joseToken(josePayload(spec, json));

      const refusal = await refusalOf(() => open(ctx.aegis, token));

      expect(refusal).toBeInstanceOf(JwtError);
      expect(refusal).toMatchObject({
        code: "jwt_claims_invalid",
        title: "Malformed NumericDate Claim",
      });
      expect((refusal as AegisError).data).toEqual({ invalid: [joseName(spec)] });
    });

    test("every malformed NumericDate claim is named, in registry order, at aegis.jwt.verify", async () => {
      const { exp: _exp, iat: _iat, ...base } = JOSE_BASE;
      const token = await joseToken(JSON.stringify({ ...base, iat: true, exp: "x" }));

      const refusal = await refusalOf(() => ctx.aegis.jwt.verify(token));

      expect(refusal).toBeInstanceOf(JwtError);
      expect(refusal).toMatchObject({
        code: "jwt_claims_invalid",
        title: "Malformed NumericDate Claim",
      });
      expect((refusal as AegisError).data).toEqual({ invalid: ["exp", "iat"] });
    });

    test.each(JOSE_ACCEPTED_ROWS)(
      "%s is read as that instant at aegis.parse",
      async (_label, spec, value) => {
        const token = await joseToken(josePayload(spec, JSON.stringify(value)));

        expect(domainValue(ctx.aegis.parse(token), spec)).toEqual(new Date(value * 1000));
      },
    );

    test.each(JOSE_ACCEPTED_ROWS)(
      "%s is read as that instant at aegis.verify",
      async (_label, spec, value) => {
        const token = await joseToken(josePayload(spec, JSON.stringify(value)));

        const verified = await ctx.aegis.verify(token, undefined, RANGE_WAIVED);

        expect(domainValue(verified, spec)).toEqual(new Date(value * 1000));
      },
    );

    test.each(JOSE_ACCEPTED_ROWS)(
      "%s is reported verbatim at aegis.jwt.verify",
      async (_label, spec, value) => {
        const token = await joseToken(josePayload(spec, JSON.stringify(value)));

        const verified = await ctx.aegis.jwt.verify(token, undefined, RANGE_WAIVED);

        expect((verified.payload as Dict)[joseName(spec)]).toBe(value);
      },
    );

    test("an expiry of 0 is refused as expired at aegis.verify, naming the claim", async () => {
      const spec = CLAIM_SPECS.find((candidate) => joseName(candidate) === "exp")!;
      const token = await joseToken(josePayload(spec, "0"));

      const refusal = await refusalOf(() => ctx.aegis.verify(token));

      expect(refusal).toBeInstanceOf(JwtError);
      expect(refusal).toMatchObject({
        code: "jwt_claims_invalid",
        title: "Claims Invalid",
      });
      expect((refusal as AegisError).data).toEqual({ invalid: ["exp"] });
    });
  });

  describe("cose", () => {
    test.each([
      ["a tag-1 epoch date", new Date(1700000000 * 1000), 0xc1],
      ["a tag-0 date-time string", new Tag(0, "2023-11-14T22:13:20Z"), 0xc0],
    ])("%s rides the wire under its tag", (_name, value, tag) => {
      expect(encodeCbor(value)[0]).toBe(tag);
    });

    test.each(COSE_REFUSED_ROWS)("%s", async (_label, spec, key, value, door) => {
      const [, kryptos, open] = door;
      const token = coseToken(kryptos, cosePayload(spec, key, value));

      const refusal = await refusalOf(() => open(ctx.aegis, token));

      expect(refusal).toBeInstanceOf(CoseError);
      expect(refusal).toMatchObject({ code: "cose_malformed" });
      expect((refusal as AegisError).data).toEqual({ claim: coseName(spec), label: key });
    });

    test.each(COSE_ACCEPTED_ROWS)(
      "%s is read as that instant at every door",
      async (_label, spec, value) => {
        const instant = new Date(value * 1000);
        const signed = coseToken(
          TEST_EC_KEY_SIG,
          cosePayload(spec, coseLabel(spec)!, value),
        );
        const maced = coseToken(
          TEST_OCT_KEY_SIG,
          cosePayload(spec, coseLabel(spec)!, value),
        );

        expect(domainValue(ctx.aegis.parse(signed.toString("base64url")), spec)).toEqual(
          instant,
        );
        expect(
          domainValue(
            await ctx.aegis.verify(signed.toString("base64url"), undefined, RANGE_WAIVED),
            spec,
          ),
        ).toEqual(instant);
        expect(
          (
            await ctx.aegis.cwt.verify(
              signed.toString("base64url"),
              undefined,
              RANGE_WAIVED,
            )
          ).payload[coseName(spec)],
        ).toEqual(instant);
        expect(
          (
            await ctx.aegis.cwm.verify(
              maced.toString("base64url"),
              undefined,
              RANGE_WAIVED,
            )
          ).payload[coseName(spec)],
        ).toEqual(instant);
        expect(CwtKit.decode(signed).payload[coseName(spec)]).toEqual(instant);
        expect(CwmKit.decode(maced).payload[coseName(spec)]).toEqual(instant);
      },
    );
  });

  describe("Aegis.toDomain", () => {
    const DICT_REFUSED_ROWS = numericDateSpecs("jose").flatMap((spec) =>
      DICT_REFUSED.map(([name, value]): [string, ClaimSpec, unknown] => [
        `${joseName(spec)} holding ${name}`,
        spec,
        value,
      ]),
    );

    const DICT_ACCEPTED_ROWS = numericDateSpecs("jose").flatMap((spec) =>
      DICT_ACCEPTED.map(([name, value, read]): [string, ClaimSpec, unknown, Date] => [
        `${joseName(spec)} holding ${name}`,
        spec,
        value,
        read,
      ]),
    );

    test.each(DICT_REFUSED_ROWS)("%s is refused", (_label, spec, value) => {
      let refusal: unknown;

      try {
        Aegis.toDomain({ [joseName(spec)]: value });
      } catch (error) {
        refusal = error;
      }

      expect(refusal).toBeInstanceOf(AegisDomainError);
      expect(refusal).toMatchObject({ code: "claim_structure_invalid" });
      expect((refusal as AegisError).data).toEqual({
        claim: spec.domain,
        invalid: [
          { key: spec.domain, message: `Claim "${spec.domain}" must be a NumericDate` },
        ],
      });
    });

    test.each(DICT_ACCEPTED_ROWS)(
      "%s is read as that instant",
      (_label, spec, value, read) => {
        expect(domainValue(Aegis.toDomain({ [joseName(spec)]: value }), spec)).toEqual(
          read,
        );
      },
    );

    test.each(
      numericDateSpecs("jose").flatMap((spec) =>
        [null, undefined].map((value): [string, ClaimSpec, null | undefined] => [
          `${joseName(spec)} holding ${String(value)}`,
          spec,
          value,
        ]),
      ),
    )("%s is not stated", (_label, spec, value) => {
      expect(
        domainValue(Aegis.toDomain({ [joseName(spec)]: value }), spec),
      ).toBeUndefined();
    });
  });
});
