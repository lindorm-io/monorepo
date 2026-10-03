import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { foreignEncrypt0 } from "../__fixtures__/foreign-encrypt0.js";
import { foreignSignedCose } from "../__fixtures__/foreign-signed-cose.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import {
  createTestDeployment,
  DEFAULT_CLOCK,
  ISSUER,
  NOW,
  type TestDeployment,
} from "../__fixtures__/test-deployment.js";
import { AegisError } from "../errors/index.js";
import type { VerifiedToken } from "../types/index.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  claimByDomain,
  coseLabel,
  coseName,
} from "../internal/claims/claims-registry.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { encodeCbor } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { encToCoseLabel } from "../internal/cose/enc-labels.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { CwtKit } from "./CwtKit.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * A COSE claim stated as the CBOR null (simple 22) or undefined (simple 23) is a
 * claim the token does not state, at every registered key form, at
 * `aegis.parse`, `aegis.verify` and the keyless `CwtKit.decode`.
 *
 * Swept here, beside the per-spec matrix, rather than in `cwt-spec.test.ts`: the
 * rows are the claim REGISTRY × the key forms a foreign producer can write, run
 * at the public doors, and the drop happens in front of the claim codec that
 * file guards — so a codec-level row cannot see whether a door still runs it.
 *
 * The tokens are hand-built CBOR maps sealed by `foreignSignedCose`: the
 * third-party producer turns a `jti` into bytes, so it cannot state a null at
 * label 7, and it keys `cnf` and every private-use claim by its text name.
 */

const SIGNING_HEADER = new Map<CoseLabel, unknown>([
  [coseByJose("alg"), algToCoseLabel(TEST_EC_KEY_SIG.algorithm)],
]);

/** A claims set a profile-less verify accepts under the mocked clock, keyed as RFC 8392 §4 assigns. */
const BASE: ReadonlyArray<[number, unknown]> = [
  [1, ISSUER],
  [2, "user-1"],
  [4, NOW + 3600],
  [6, NOW - 60],
  [7, Buffer.from("token-1", "utf8")],
];

/** The CBOR null and undefined, simple values 22 and 23 (RFC 8949 §3.3). */
const UNSTATED: ReadonlyArray<[name: string, value: null | undefined, head: number]> = [
  ["the CBOR null", null, 0xf6],
  ["the CBOR undefined", undefined, 0xf7],
];

/**
 * Every key form a registered claim can take on the COSE wire: its integer label
 * where it has one, and its text name — the text twin of labels 1–9, a
 * private-use claim's alias, or a label-less claim's only key.
 */
const KEY_FORMS: ReadonlyArray<[form: string, spec: ClaimSpec, key: CoseLabel]> =
  CLAIM_SPECS.flatMap((spec) => {
    const label = coseLabel(spec);
    const name = coseName(spec);
    const textName: [string, ClaimSpec, CoseLabel] = [
      `${spec.domain} at the text name "${name}"`,
      spec,
      name,
    ];

    return label === undefined
      ? [textName]
      : [[`${spec.domain} at the label ${label}`, spec, label], textName];
  });

/** A claim a profile-less verify demands, and the code it refuses a token without it under. */
const DEMANDED: Readonly<Record<string, string>> = { expiresAt: "missing_claim_exp" };

type Row = [
  label: string,
  spec: ClaimSpec,
  key: CoseLabel,
  value: null | undefined,
  head: number,
];

const ROWS: ReadonlyArray<Row> = KEY_FORMS.flatMap(([form, spec, key]) =>
  UNSTATED.map(
    ([name, value, head]): Row => [`${form}, stated as ${name}`, spec, key, value, head],
  ),
);

const VERIFIED_ROWS = ROWS.filter(([, spec]) => !Object.hasOwn(DEMANDED, spec.domain));

const REFUSED_ROWS = ROWS.filter(([, spec]) => Object.hasOwn(DEMANDED, spec.domain));

/** The base claims set without the claim under any key, then the claim at `key`. */
const payloadStating = (spec: ClaimSpec, key: CoseLabel, value: unknown): Buffer => {
  const claims = new Map<CoseLabel, unknown>(
    BASE.filter(([label]) => label !== coseLabel(spec)),
  );

  claims.set(key, value);

  return encodeCbor(claims);
};

const signed = (payload: Buffer): string =>
  foreignSignedCose(TEST_EC_KEY_SIG, SIGNING_HEADER, payload).toString("base64url");

type ResultBuckets = {
  claims: Dict;
  custom: Dict;
  profile?: Dict;
  sensitive?: Dict;
};

/**
 * Every position the claim answers at: its domain name in a domain bucket, and any
 * key at all in `custom` — the base claims set carries no custom claim, so a key
 * there is a registered claim that reached the wrong bucket.
 */
const statedAt = (result: ResultBuckets, spec: ClaimSpec): Array<string> => {
  const buckets: Record<string, Dict> = {
    claims: result.claims,
    profile: result.profile ?? {},
    sensitive: result.sensitive ?? {},
  };

  return [
    ...Object.entries(buckets)
      .filter(([, bag]) => Object.hasOwn(bag, spec.domain))
      .map(([bucket]) => `${bucket}.${spec.domain}`),
    ...Object.keys(result.custom).map((key) => `custom.${key}`),
  ];
};

/** The decoded payload a verified result reports beside its domain buckets. */
const wirePayloadOf = (verified: VerifiedToken): Dict => {
  if (verified.wire === undefined) {
    throw new Error("the verified token reports no wire payload");
  }

  return verified.wire.payload;
};

describe("Aegis — a COSE claim stated as null or undefined is not stated", () => {
  let ctx: TestDeployment;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createTestDeployment();
  });

  test("should sweep every registered claim at every key form it can take", () => {
    expect(CLAIM_SPECS.length).toBeGreaterThan(0);
    expect(new Set(KEY_FORMS.map(([, spec]) => spec.domain)).size).toBe(
      CLAIM_SPECS.length,
    );
    expect(KEY_FORMS.length).toBe(
      CLAIM_SPECS.length +
        CLAIM_SPECS.filter((spec) => coseLabel(spec) !== undefined).length,
    );
  });

  test("should demand only claims the registry declares", () => {
    for (const domain of Object.keys(DEMANDED)) {
      expect(claimByDomain(domain), domain).toBeDefined();
    }
  });

  test.each(ROWS)(
    "%s rides the wire as that simple value",
    (_label, spec, key, value, head) => {
      const payload = payloadStating(spec, key, value);

      expect(
        payload.includes(Buffer.concat([encodeCbor(key), Buffer.from([head])])),
      ).toBe(true);
    },
  );

  test.each(ROWS)("%s is not stated at aegis.parse", (_label, spec, key, value) => {
    const parsed = ctx.aegis.parse(signed(payloadStating(spec, key, value)));

    expect(statedAt(parsed as ResultBuckets, spec)).toEqual([]);
  });

  test.each(ROWS)("%s is not stated at CwtKit.decode", (_label, spec, key, value) => {
    const signedToken = foreignSignedCose(
      TEST_EC_KEY_SIG,
      SIGNING_HEADER,
      payloadStating(spec, key, value),
    );
    const { payload } = CwtKit.decode(signedToken);

    expect(Object.hasOwn(payload, coseName(spec))).toBe(false);
    expect(Object.hasOwn(payload, String(key))).toBe(false);
  });

  test.each(VERIFIED_ROWS)(
    "%s is not stated at aegis.verify",
    async (_label, spec, key, value) => {
      const verified = await ctx.aegis.verify(signed(payloadStating(spec, key, value)));

      expect(statedAt(verified as ResultBuckets, spec)).toEqual([]);
      expect(Object.hasOwn(wirePayloadOf(verified), coseName(spec))).toBe(false);
      expect(Object.hasOwn(wirePayloadOf(verified), String(key))).toBe(false);
    },
  );

  test.each(REFUSED_ROWS)(
    "%s is not stated at aegis.verify, which refuses the token for the claim it demands",
    async (_label, spec, key, value) => {
      const refusal = await ctx.aegis
        .verify(signed(payloadStating(spec, key, value)))
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      expect(refusal).toBeInstanceOf(AegisError);
      expect(refusal).toMatchObject({ code: DEMANDED[spec.domain] });
    },
  );

  test("a CWT sealed in a COSE_Encrypt0 reads a null sensitive claim as not stated at aegis.verify", async () => {
    ctx.amphora.add(TEST_OCT_KEY_ENC);

    const spec = claimByDomain("nationalIdentityNumber")!;
    const inner = foreignSignedCose(
      TEST_EC_KEY_SIG,
      SIGNING_HEADER,
      payloadStating(spec, coseLabel(spec)!, null),
    );
    const token = foreignEncrypt0(
      TEST_OCT_KEY_ENC,
      new Map<CoseLabel, unknown>([
        [coseByJose("alg"), encToCoseLabel("A256GCM")],
        [coseByJose("cty"), "application/cwt"],
      ]),
      inner,
    ).toString("base64url");

    const verified = await ctx.aegis.verify(token);

    expect(verified.wrapper).toBe("cwe");
    expect(statedAt(verified as ResultBuckets, spec)).toEqual([]);
    expect(Object.hasOwn(wirePayloadOf(verified), coseName(spec))).toBe(false);
  });
});
