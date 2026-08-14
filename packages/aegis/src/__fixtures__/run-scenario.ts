import {
  Algorithms,
  COSEKey,
  Headers,
  Mac0,
  MacAlgorithms,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders,
} from "@auth0/cose";
import { createHash } from "node:crypto";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { LindormError } from "@lindorm/errors";
import { isArray, isDate, isObject, isString } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { CompactSign, importJWK } from "jose";
import MockDate from "mockdate";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import {
  AegisDomainError,
  AegisError,
  AegisKeyError,
  CoseError,
  CweError,
  CwmError,
  CwsError,
  CwtError,
  JoseError,
  JweError,
  JwsError,
  JwtError,
} from "../errors/index.js";
import { CLAIM_SPECS, coseName, joseName } from "../internal/claims/claims-registry.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { encodeCwtClaims } from "../internal/cose/cwt-claims.js";
import { decodeCwtWire } from "../internal/cose/decode-cwt-wire.js";
import { COSE_TAG, decodeProtectedHeader } from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { WIRE_TAGS } from "../internal/registry/wire.js";
import type {
  ParsedDpopProof,
  TokenContent,
  TokenFormat,
  TokenFormatTag,
} from "../types/index.js";
import { inspectToken, type RawLabelMap, type TokenInspection } from "./inspect-token.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_ENC_CERT,
  TEST_EC_KEY_SIG,
  TEST_EC_KEY_SIG_CERT,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_ENC_CBC,
  TEST_OCT_KEY_ENC_GCM128,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_ENC,
  TEST_RSA_KEY_SIG,
} from "./keys.js";
import {
  ISSUER,
  type ArtifactGivenStep,
  type CoseBucketsGiven,
  type DateCell,
  type DpopProofGiven,
  type ErrorClassName,
  type Given,
  type KeyFixture,
  type PlainVerifyStep,
  type ProfiledVerifyStep,
  type RejectsThenStep,
  type Scenario,
  type TamperSegment,
  type ThenStep,
  type ThumbprintCell,
  type WhenStep,
  type Wire,
  type WireAssertion,
  type WireKey,
} from "./scenarios.js";

/**
 * The scenario INTERPRETER — the whole code half of the conformance table, and
 * the future Gherkin step-definition layer.
 *
 * Every step a row may name is implemented here exactly once; a row contributes
 * literals and nothing else. Keeping the two apart is what lets the table be
 * machine-converted later, and it is also what stops a row from quietly encoding
 * behaviour that belongs under test.
 */

/** The clock every row runs at unless a `clock` GIVEN step names another. */
export const DEFAULT_CLOCK = "2024-01-01T08:00:00.000Z";

const KEY_FIXTURES: Record<KeyFixture, IKryptos> = {
  "ec-sig": TEST_EC_KEY_SIG,
  "ec-enc": TEST_EC_KEY_ENC,
  "ec-sig-cert": TEST_EC_KEY_SIG_CERT,
  "ec-enc-cert": TEST_EC_KEY_ENC_CERT,
  "oct-sig": TEST_OCT_KEY_SIG,
  "oct-enc": TEST_OCT_KEY_ENC,
  "oct-enc-cbc": TEST_OCT_KEY_ENC_CBC,
  "oct-enc-gcm128": TEST_OCT_KEY_ENC_GCM128,
  "okp-sig": TEST_OKP_KEY_SIG,
  "okp-enc": TEST_OKP_KEY_ENC,
  "rsa-sig": TEST_RSA_KEY_SIG,
  "rsa-enc": TEST_RSA_KEY_ENC,
};

const ERROR_CLASSES: Record<ErrorClassName, typeof LindormError> = {
  AegisError,
  AegisDomainError,
  AegisKeyError,
  JwtError,
  JwsError,
  JweError,
  CwtError,
  CwmError,
  CwsError,
  CweError,
  JoseError,
  CoseError,
  LindormError,
};

export type ScenarioContext = {
  /**
   * ⚠ MUTABLE. A `deployment` GIVEN step REPLACES it, because the settings it
   * states are constructor arguments — there is no other way to reach them.
   */
  aegis: Aegis;
  amphora: IAmphora;
  /** Kept so a rebuilt `Aegis` is the same deployment in every other respect. */
  logger: ILogger;
};

/**
 * The seed suite's setup, verbatim: an Amphora scoped to the test issuer, a mock
 * logger, and the ES512 signing key every row starts from. Further vault
 * residents are added per row by a `keys` GIVEN step.
 */
export const createScenarioContext = async (): Promise<ScenarioContext> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
  const aegis = new Aegis({ amphora, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  return { aegis, amphora, logger };
};

/**
 * Revive every DATA CELL in a row, deeply, and CLONE everything else on the way.
 *
 * Two values a row needs cannot be JSON literals: a {@link DateCell} because JSON
 * has no date, and a {@link ThumbprintCell} because a key's digest belongs to the
 * key material rather than to the row. Both are spelled as a single-member object
 * and resolved here; the table's serialisability test is what would otherwise
 * catch a live `Date` written into a bag typed as `Dict`.
 *
 * The CLONE is what keeps a row reusable: the table is a module-level literal
 * shared by every wire in the matrix, and by the second run the defect check
 * performs, so a step that mutated its own input would leak across both.
 *
 * ⚠ A live `Date` passes through untouched. `isObject` is false for one, so the
 * recursion never walks its properties — but the guard is explicit here because
 * this function is also handed rows the knob interpreter has ALREADY revived.
 */
const reviveCells = <T>(value: T): T => {
  if (isDate(value)) return value;
  if (isArray(value)) return value.map(reviveCells) as unknown as T;

  if (!isObject(value)) return value;

  const entries = Object.entries(value as Dict);

  if (entries.length === 1 && entries[0][0] === "date" && isString(entries[0][1])) {
    return new Date((value as unknown as DateCell).date) as unknown as T;
  }

  if (
    entries.length === 1 &&
    entries[0][0] === "thumbprintOf" &&
    isString(entries[0][1])
  ) {
    const fixture = (value as unknown as ThumbprintCell).thumbprintOf;
    const kryptos = KEY_FIXTURES[fixture];

    if (kryptos === undefined) {
      throw new Error(`the row names a thumbprint of the unknown key "${fixture}"`);
    }

    return kryptos.thumbprint as unknown as T;
  }

  return Object.fromEntries(
    entries.map(([key, entry]) => [key, reviveCells(entry)]),
  ) as T;
};

/**
 * The artifact step is the LAST GIVEN step — the tuple type says so, and this
 * says it once at runtime so no reader has to re-derive it from an index.
 */
export const artifactStepOf = (given: Given): ArtifactGivenStep => {
  const last = given[given.length - 1];

  if (last.step === "token" || last.step === "claims") return last;

  throw new Error(`the last GIVEN step must build the artifact, received "${last.step}"`);
};

/**
 * The wire an artifact PINS ITSELF to, or `undefined` when it is wire-agnostic.
 *
 * A concrete kit names its own wire; a `mint` or a `domain-encrypt` is pinned
 * only by an explicit `options.format`. A claim-only row builds no token at all,
 * so it is agnostic by nature — the static matcher surface has no wire.
 */
export const artifactWireOf = (artifact: ArtifactGivenStep): Wire | undefined => {
  if (artifact.step === "claims") return undefined;

  switch (artifact.via) {
    case "kit-sign":
      switch (artifact.kit) {
        case "jwt":
        case "jws":
          return "jose";
        case "cwt":
        case "cws":
          return "cose";
        case "structured":
        case "opaque":
          return undefined;
        default: {
          const exhaustive: never = artifact;
          throw new Error(`unhandled kit-sign artifact ${JSON.stringify(exhaustive)}`);
        }
      }

    case "kit-encrypt":
      switch (artifact.kit) {
        case "jwe":
          return "jose";
        case "cwe":
          return "cose";
        case "sealed":
          return undefined;
        default: {
          const exhaustive: never = artifact;
          throw new Error(`unhandled kit-encrypt artifact ${JSON.stringify(exhaustive)}`);
        }
      }

    // A foreign producer writes whichever wire the run is on — the step names a
    // header, never an encoding.
    case "foreign":
      return undefined;

    case "mint":
    case "domain-encrypt": {
      const format = artifact.options?.format;
      if (!isString(format)) return undefined;
      return format.startsWith("c") ? "cose" : "jose";
    }

    default: {
      const exhaustive: never = artifact;
      throw new Error(`unhandled artifact ${JSON.stringify(exhaustive)}`);
    }
  }
};

/**
 * A row's OWN wire, if it has pinned itself to one. The table's integrity test
 * uses it to demand an `unsupported` reason for the wire such a row leaves
 * uncovered — that debt is what makes coverage the default rather than a habit.
 */
export const pinnedWireOf = (scenario: Scenario): Wire | undefined =>
  artifactWireOf(artifactStepOf(scenario.given));

/**
 * The wires a row RUNS ON: every wire aegis speaks, less the ones the row
 * declares it cannot state the capability on.
 *
 * A row pinned to one wire runs on that one alone — and owes the other an
 * `unsupported` entry, which the integrity test collects. An agnostic row runs
 * on everything left after its own declarations.
 */
export const wiresOf = (scenario: Scenario): ReadonlyArray<Wire> => {
  const pinned = pinnedWireOf(scenario);
  const wires = pinned === undefined ? WIRE_TAGS : [pinned];

  return wires.filter((wire) => scenario.unsupported?.[wire] === undefined);
};

/**
 * The wire a row PINS ITSELF TO and then declares UNSUPPORTED — a row
 * documenting the absence of itself, and `undefined` for every well-formed row.
 *
 * ⚠ Derived from the row's OWN TWO DECLARATIONS — the artifact it builds and the
 * reasons it states — and never from {@link wiresOf}. Asking `wiresOf` is how the
 * predecessor of this function was dead twice over: the first version filtered on
 * a field the row never set, and its replacement asked whether any wire in
 * `wiresOf(scenario)` appeared in `unsupported` — the exact negation of the filter
 * that had just produced that array, so it was empty for every table that could
 * ever be written. A check whose input is the output of the rule it is checking
 * cannot fail.
 *
 * An AGNOSTIC row is not covered and must not be: `unsupported` is precisely how
 * such a row states the wires it does not run on, so an entry there is the
 * declaration working, not a contradiction.
 */
export const selfMarkedWireOf = (scenario: Scenario): Wire | undefined => {
  const pinned = pinnedWireOf(scenario);

  if (pinned === undefined) return undefined;

  return scenario.unsupported?.[pinned] === undefined ? undefined : pinned;
};

/**
 * The defect a row declares FOR ONE WIRE, or `undefined` when it declares none
 * there.
 *
 * A bare string is a shortfall on every wire the row runs on; the per-wire form
 * states it for exactly the wires that have it. Resolving the two here is what
 * lets the table's invariant be checked per (row, wire) CELL — which it always
 * was, against a field that could only speak for the whole row, so a capability
 * holding on one wire and failing on the other could not be declared at all.
 *
 * ⚠ It reads the row's OWN declaration and never the run's verdict. A resolver
 * that consulted the outcome would make the invariant unfalsifiable, which is
 * the shape two other checks in this file have already been dead in.
 */
export const knownDefectOn = (scenario: Scenario, wire: Wire): string | undefined => {
  const { knownDefect } = scenario;

  if (knownDefect === undefined) return undefined;
  if (isString(knownDefect)) return knownDefect;

  return knownDefect[wire];
};

/**
 * The uniform shape every step reduces to, so an outcome can be asserted without
 * knowing which step produced it. `claims`/`custom`/`header` come from a domain
 * verify, `token`/`format` from any artifact-producing step.
 */
type ScenarioResult = {
  token: string;
  format?: string;
  claims?: Dict;
  custom?: Dict;
  header?: Dict;
  /**
   * The OPAQUE payload — an artifact whose body is not a claims layer, delivered
   * beside an empty domain. In a CELL for the same reason as the header above:
   * only `parse`/`verify`/`decrypt` report one at all, and a row asserting on the
   * payload of an act that reports none must fail rather than pass on silence.
   */
  raw?: { value: TokenContent | undefined };
  /** The UNTRANSLATED wire claims a domain read passes through, in a cell. */
  wire?: { value: Dict | undefined };
  /**
   * The read-side CATEGORY buckets, in one cell. They have no wire
   * representation — they exist only on a domain result — so an act that
   * produces no domain result reports no cell and a row asserting on one fails
   * by name.
   */
  buckets?: { value: { profile?: Dict; sensitive?: Dict; delegation?: Dict } };
  /**
   * The VERIFIED proof of possession, in a cell for the same reason as the rest:
   * only a `verify` handed a `dpopProof` reports one, so a row asserting on it
   * against an act that reports none must fail by name rather than pass on the
   * act's silence — which is exactly how the success path came to be unexercised.
   */
  dpop?: { value: ParsedDpopProof | undefined };
};

/**
 * The CLEARTEXT wire payload of an artifact, for the include/exclude assertions.
 *
 * UNREADABILITY IS SIGNALLED, never flattened to an empty dict: a JWE's payload
 * is ciphertext, and `expect({}).not.toHaveProperty(x)` can never fail, so an
 * exclusion asserted against it would pass without checking anything. The caller
 * turns an unreadable payload into a FAILURE. A COSE payload comes back
 * COSE-name-keyed (`cti`, not `jti`).
 */
export type WirePayload =
  | { readable: true; payload: Dict }
  | { readable: false; reason: string };

/**
 * The formats whose payload is ciphertext — the complement of `TokenFormat`, so
 * a new encrypted format is a COMPILE error here rather than a silent omission.
 */
const ENCRYPTED_FORMATS: Record<Exclude<TokenFormatTag, TokenFormat>, true> = {
  jwe: true,
  cwe: true,
};

export const readWirePayload = (token: string, format?: string): WirePayload => {
  // Refuse an ENCRYPTED artifact on its DECLARED format, before touching a byte.
  // Inferring unreadability from the token's SHAPE is JOSE-only reasoning: a JWE
  // is recognisable by its five parts, but a CWE is a COSE_Encrypt0 — a
  // three-element array, which satisfies the `{ atLeast: 3 }` arity
  // `decodeCwtWire` asks for
  // (`src/internal/cose/unwrap-cose.ts#contents.length >= arity.atLeast`), so its
  // CIPHERTEXT reaches the CBOR decoder and is refused only by the luck of not
  // parsing as CBOR. Luck is not an exclusion, and when it runs out the row
  // passes vacuously.
  if (isString(format) && format in ENCRYPTED_FORMATS) {
    return {
      readable: false,
      reason: `a ${format} artifact's payload is ciphertext, so there is no cleartext wire to read`,
    };
  }

  if (token.includes(".")) {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return {
        readable: false,
        reason: `a ${parts.length}-part JOSE token has no cleartext payload (only a 3-part JWS does; a 5-part JWE's is ciphertext)`,
      };
    }

    // A 3-part token is not necessarily a JWT: `aegis.jws.sign(buffer)` produces a
    // JWS whose payload is opaque bytes. Let that surface as the harness's OWN
    // diagnostic rather than a raw SyntaxError from three frames down — the
    // caller's message names the row's mistake, a SyntaxError names none.
    try {
      return {
        readable: true,
        payload: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Dict,
      };
    } catch (err) {
      return {
        readable: false,
        reason: `the JWS payload is not JSON — it is an opaque body (${(err as Error).message})`,
      };
    }
  }

  try {
    return {
      readable: true,
      payload: decodeCwtWire(Buffer.from(token, "base64url")).payload as Dict,
    };
  } catch (err) {
    return {
      readable: false,
      reason: `the token is not a decodable COSE structure (${(err as Error).message})`,
    };
  }
};

/**
 * One RAW wire bucket in the form the assertions consume: a `has` over the wire's
 * OWN key type, and a record for `toMatchObject`.
 *
 * ⚠ `has` takes the raw key. RFC 9052 §1.5 defines `label = int / tstr`, so a
 * lookup that stringified its key would merge the integer label `4` with the text
 * label `"4"` — two different parameters. The RECORD is stringified because that
 * is what a JS object literal in a row already is (`{ 16: … }` has the key
 * `"16"`), and it is only ever used for value comparison.
 */
type ComparableBucket = { has: (key: WireKey) => boolean; record: Dict };

const joseBucket = (source: Dict): ComparableBucket => ({
  has: (key) => Object.prototype.hasOwnProperty.call(source, String(key)),
  record: source,
});

const coseBucket = (source: RawLabelMap): ComparableBucket => ({
  has: (key) => source.has(key),
  record: Object.fromEntries([...source].map(([label, value]) => [String(label), value])),
});

/**
 * The RAW bucket a wire step names, read by the INDEPENDENT inspector.
 *
 * THROWS for a bucket that is not there to read — a JWE's ciphertext payload, a
 * JOSE unprotected bucket that does not exist — rather than handing back an
 * empty one. Every assertion below is an inclusion or an exclusion, and both pass
 * over an empty container without checking anything, so the empty answer is the
 * vacuous pass this whole layer exists to prevent.
 */
const wireBucketOf = (
  inspection: TokenInspection,
  bucket: "protectedHeader" | "unprotectedHeader" | "claims",
): ComparableBucket => {
  if (inspection.wire === "jose") {
    switch (bucket) {
      case "protectedHeader":
        return joseBucket(inspection.protectedHeader);

      case "unprotectedHeader":
        throw new Error(
          "the row asserts on the raw unprotected header, but a JOSE compact serialisation has no such bucket (RFC 7515 §7.1). " +
            'Assert `{ step: "wireUnprotectedHeader", absent: true }` instead.',
        );

      case "claims": {
        if (inspection.payload.readable === false) {
          throw new Error(
            `the row asserts on the raw wire claims, but ${inspection.payload.reason}. ` +
              "Assert the header or the format instead — the claims cannot be checked here.",
          );
        }
        return joseBucket(inspection.payload.value);
      }

      default: {
        const exhaustive: never = bucket;
        throw new Error(`unhandled wire bucket "${String(exhaustive)}"`);
      }
    }
  }

  switch (bucket) {
    case "protectedHeader":
      return coseBucket(inspection.protectedHeader);

    case "unprotectedHeader":
      return coseBucket(inspection.unprotectedHeader);

    case "claims": {
      if (inspection.payload.readable === false) {
        throw new Error(
          `the row asserts on the raw wire claims, but ${inspection.payload.reason}. ` +
            "Assert the header or the format instead — the claims cannot be checked here.",
        );
      }
      return coseBucket(inspection.payload.value);
    }

    default: {
      const exhaustive: never = bucket;
      throw new Error(`unhandled wire bucket "${String(exhaustive)}"`);
    }
  }
};

/** Apply one row's `includes`/`present`/`excludes` to a raw bucket. */
const assertWireBucket = (assertion: WireAssertion, bucket: ComparableBucket): void => {
  if (assertion.includes) {
    expect(bucket.record).toMatchObject(assertion.includes);
  }
  for (const key of assertion.present ?? []) {
    expect(bucket.has(key), `expected the raw wire bucket to carry ${String(key)}`).toBe(
      true,
    );
  }
  for (const key of assertion.excludes ?? []) {
    expect(
      bucket.has(key),
      `expected the raw wire bucket NOT to carry ${String(key)}`,
    ).toBe(false);
  }
};

/**
 * The thumbprint a token BINDS itself to, read off the raw wire by the
 * INDEPENDENT inspector — RFC 7800 §3.1 `cnf`, RFC 9449 §6.1 `jkt`.
 *
 * ⚠ Read from the token rather than from the verify result on purpose. The
 * possession check's whole claim is that the proof was made by the key the TOKEN
 * names; comparing the result's reported thumbprint to the result's own bound
 * thumbprint would be satisfied by a verifier that fabricated both, which is
 * precisely the class of hole that left this path unexercised.
 */
const confirmationThumbprintOf = (token: string): string | undefined => {
  const inspection = inspectToken(token);

  if (inspection.payload.readable === false) return undefined;

  const claims = inspection.payload.value as Dict;
  const cnf = inspection.wire === "jose" ? claims.cnf : (claims.cnf ?? claims[8]);

  if (!cnf || typeof cnf !== "object") return undefined;

  const jkt = (cnf as Dict).jkt;

  return isString(jkt) ? jkt : undefined;
};

/**
 * The value inside a result CELL, or the harness's own diagnostic.
 *
 * A row asserting on something the last act never reports would otherwise be
 * asserting against `undefined`, and every exclusion and every absence check
 * passes over `undefined` — the vacuous pass the cells exist to prevent. Name the
 * acts that DO report it, so the row is repaired rather than puzzled over.
 */
const cellOf = <T>(cell: { value: T } | undefined, what: string, from: string): T => {
  if (cell === undefined) {
    throw new Error(
      `the row asserts on ${what}, but the last act reported none — only ${from} report it.`,
    );
  }

  return cell.value;
};

/** GIVEN — stock the vault and set the clock, then build the artifact. */
const applySetup = (given: Given, ctx: ScenarioContext): void => {
  MockDate.set(new Date(DEFAULT_CLOCK));

  for (const step of given) {
    switch (step.step) {
      case "keys":
        for (const fixture of step.keys) {
          ctx.amphora.add(KEY_FIXTURES[fixture]);
        }
        break;

      case "clock":
        MockDate.set(new Date(step.at));
        break;

      // The settings are CONSTRUCTOR arguments, so the only way to state them is
      // to build the deployment again. The vault is the SAME one — a `keys` step
      // stocks it, and rebuilding around it is what keeps the two steps
      // independent of the order a row writes them in.
      case "deployment":
        ctx.aegis = new Aegis({
          amphora: ctx.amphora,
          logger: ctx.logger,
          ...step.settings,
        });
        break;

      case "token":
      case "claims":
        break;

      default: {
        const exhaustive: never = step;
        throw new Error(`unhandled given step ${JSON.stringify(exhaustive)}`);
      }
    }
  }
};

/**
 * Reassemble the single claims container the public API takes from the row's two
 * halves. A row states registered and unregistered claim names APART so the
 * registered half can be typed; the API has one bag, and this is the only place
 * that knows both facts.
 */
const mergeMintClaims = (content: Dict): Dict => {
  const { claims, unregisteredClaims, ...rest } = content;

  if (claims === undefined && unregisteredClaims === undefined) return content;

  return {
    ...rest,
    claims: { ...(claims as Dict), ...(unregisteredClaims as Dict) },
  };
};

/**
 * The JOSE→COSE claim-name divergences, DERIVED from the claim registry — the
 * one place that knows what a claim is called on each wire. Today it yields
 * exactly one pair (`jti` → `cti`, RFC 8392 §3.1.7); a second registered divergence
 * is picked up here without an edit.
 *
 * ⚠ Deriving rather than hand-listing is the point. A claim left under its JOSE
 * name on a COSE wire raises no error — it is simply an unregistered custom
 * claim — so a stale hand-copy would not fail, it would quietly stop testing the
 * registered claim and start testing a custom one that happens to look like it.
 * That is the same look-alike confusion several rows in this table exist to
 * catch, and it would have been reintroduced by the harness meant to run them.
 */
const COSE_CLAIM_SPELLING: ReadonlyMap<string, string> = new Map(
  CLAIM_SPECS.filter((spec) => coseName(spec) !== joseName(spec)).map((spec) => [
    joseName(spec),
    coseName(spec),
  ]),
);

/** Re-spell a JOSE-spelled passthrough claims bag for the COSE wire. */
const respellForCose = (claims: Dict): Dict =>
  Object.fromEntries(
    Object.entries(claims).map(([key, value]) => [
      COSE_CLAIM_SPELLING.get(key) ?? key,
      value,
    ]),
  );

/**
 * The concrete kit a wire-agnostic sign/encrypt step resolves to. Total over
 * both wires, so a new wire is a compile error here rather than a row that
 * silently stops running.
 */
const AGNOSTIC_KITS = {
  structured: { jose: "jwt", cose: "cwt" },
  opaque: { jose: "jws", cose: "cws" },
  sealed: { jose: "jwe", cose: "cwe" },
} as const satisfies Record<"structured" | "opaque" | "sealed", Record<Wire, string>>;

/** The claims format a wire-agnostic `mint` / `domain-encrypt` resolves to. */
const AGNOSTIC_FORMATS = {
  mint: { jose: "jwt", cose: "cwt" },
  encrypt: { jose: "jwe", cose: "cwe" },
} as const satisfies Record<"mint" | "encrypt", Record<Wire, string>>;

/**
 * The FOREIGN producers — the write half of the foreign-token step, one per wire,
 * each a third-party library signing with the vault's own baseline key.
 *
 * ⚠ Third-party ON PURPOSE, and not merely for convenience: a token aegis wrote
 * and aegis read proves the two agree, never that either is right. These two are
 * what put an envelope aegis cannot itself produce in front of the read path.
 *
 * The COSE side reuses the framing the interop suite established: `@auth0/cose`
 * emits a BARE COSE_Sign1 (tag 18) and aegis reads `Tag(61, Tag(18, …))`
 * (RFC 8392 §6 — the CWT CBOR tag), so their structure is re-framed rather than
 * re-signed. The `kid` rides the UNPROTECTED bucket, which is where RFC 9052
 * §3.1 permits a non-integrity-critical parameter to sit and where aegis's key
 * resolution reads it from.
 */
const signForeignJose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  buckets: CoseBucketsGiven | undefined,
): Promise<string> => {
  // A JOSE compact serialisation has ONE header and no bucket to place a
  // parameter in (RFC 7516/7515 §7.1), so a row that names the COSE buckets has
  // no meaning here. Say so rather than sign a token that quietly ignores half
  // the row.
  if (buckets !== undefined) {
    throw new Error(
      "the row places parameters in named COSE header buckets, but this run is on the JOSE wire, whose compact serialisation has only one header. " +
        "Scope the row with `unsupported: { jose: … }`.",
    );
  }

  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  return new CompactSign(Buffer.from(JSON.stringify(claims), "utf8"))
    .setProtectedHeader({
      alg: kryptos.algorithm,
      kid: kryptos.id,
      ...(typ === undefined ? {} : { typ }),
    })
    .sign(key);
};

/**
 * The COSE `typ` header label. RFC 9596 §2 DEFINES the parameter and §4.1 is the
 * IANA registration that assigns it label 16 — which postdates `@auth0/cose`'s
 * `Headers` enum, hence the numeric literal and the one cast below. Stated here
 * rather than inline so the number is not a mystery.
 */
const COSE_TYP_LABEL = 16;

/**
 * The COSE algorithm identifier for a key fixture's JOSE algorithm name. Only
 * the algorithms the fixtures actually carry are mapped: an unmapped one is a
 * row asking for a producer that does not exist, and saying so beats emitting a
 * token under the wrong `alg`.
 */
const coseAlgorithmOf = (kryptos: IKryptos): number => {
  switch (kryptos.algorithm) {
    // RFC 9053 §2.1 Table 1 — ES512 is -36.
    case "ES512":
      return Algorithms.ES512;
    // RFC 9053 §3.1 Table 7 — HMAC 256/256 is 5.
    case "HS256":
      return MacAlgorithms.HS256;
    default:
      throw new Error(
        `the foreign COSE producer has no algorithm mapping for "${kryptos.algorithm}" — add one`,
      );
  }
};

/**
 * The row's extra COSE header entries, translated to the integer labels the
 * parameters are keyed under.
 *
 * ⚠ Through `coseByJose`, i.e. through AEGIS'S OWN registry, and that is
 * deliberate: the point of placing a parameter in the unprotected bucket is to
 * put it exactly where aegis WOULD read it from. A hand-picked label the reader
 * does not look at would make every such row pass for the wrong reason — the
 * parameter would be ignored because it was invisible, not because the placement
 * rule refused it.
 */
const coseBucketEntries = (bag: Dict | undefined): Array<[number, unknown]> =>
  Object.entries(bag ?? {}).map(([jose, value]) => [coseByJose(jose), value]);

const signForeignCose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  buckets: CoseBucketsGiven | undefined,
): Promise<string> => {
  const jwk = kryptos.export("jwk") as Dict;

  const protectedEntries: Array<[number, unknown]> = [
    [Headers.Algorithm, coseAlgorithmOf(kryptos)],
  ];

  if (typ !== undefined) protectedEntries.push([COSE_TYP_LABEL, typ]);

  protectedEntries.push(...coseBucketEntries(buckets?.protectedHeader));

  const protectedHeaders = new ProtectedHeaders(protectedEntries as never);
  // The row's own unprotected entries are appended AFTER the derived `kid`,
  // which is the routing hint aegis's COSE key resolution reads.
  // ⚠ `as never` on the row's own entries, for the same reason the protected
  // bucket above takes one: `@auth0/cose`'s `UnprotectedHeaders` types its value
  // union per KNOWN label, and a row here places parameters at labels it has
  // never heard of (RFC 9596's `typ` = 16, the lindorm private-use `oid`) —
  // which is exactly the point of a foreign producer.
  const unprotectedHeaders = new UnprotectedHeaders([
    [Headers.KeyID, Buffer.from(kryptos.id, "utf8")],
    ...(coseBucketEntries(buckets?.unprotectedHeader) as never),
  ]);
  // ⚠ `proprietary: false` — the INTEROPERABLE spelling, which is what a third
  // party emits. A foreign producer has never heard of this package's
  // private-use integer labels, so encoding its payload with them would put the
  // LESS interoperable wire in front of the read path while the row's premise
  // says the opposite: every row here exists to state what aegis must accept
  // from somebody else.
  //
  // The claims are still encoded by aegis's own CWT codec rather than by
  // `@auth0/cose`, and that is a limit of this producer: the foreign library
  // writes COSE structures and signatures, not CWT claim labels (RFC 8392 §4),
  // so the label mapping has no third-party implementation here to borrow. What
  // the foreign half genuinely provides — the COSE_Sign1/COSE_Mac0 framing and
  // the signature over it — is the half aegis cannot check against itself.
  const payload = Buffer.from(
    encodeCbor(encodeCwtClaims(claims as never, { proprietary: false })),
  );

  // A SHARED SECRET authenticates a CWT as a COSE_Mac0 and never as a
  // COSE_Sign1: RFC 9052 §4.2 defines the latter as carrying a digital
  // signature, whose whole property is that only the private-key holder could
  // have produced it, and §6.2 defines the former as the MACed structure with an
  // implicit key. Emitting a symmetric token under the signature structure would
  // be the confusion the two structures exist to prevent, so the producer picks
  // the structure the key admits.
  if (kryptos.type === "oct") {
    const { kty, k } = jwk;

    const mac0 = await Mac0.create(
      // ⚠ `Mac0.create` declares its own `MacProtectedHeaders`, whose value union
      // is narrower than the signature one's; the entries here are common to
      // both, so the cast crosses two declarations of the same bucket rather
      // than widening anything.
      protectedHeaders as never,
      unprotectedHeaders,
      payload,
      await COSEKey.fromJWK({ kty, k } as never).toKeyLike(),
    );

    return Buffer.from(
      encodeCbor(
        new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.mac0, mac0.getContentForEncoding())),
      ),
    ).toString("base64url");
  }

  const { kty, crv, x, y, d } = jwk;

  const sign1 = await Sign1.sign(
    protectedHeaders,
    unprotectedHeaders,
    payload,
    await COSEKey.fromJWK({ kty, crv, x, y, d } as never).toKeyLike(),
  );

  return Buffer.from(
    encodeCbor(
      new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.sign1, sign1.getContentForEncoding())),
    ),
  ).toString("base64url");
};

/**
 * The access token a CAPTURED proof commits to — any token that is not the one
 * presented. Its exact value is irrelevant; that it DIFFERS is the whole
 * property, so it is spelled here once rather than restated by a row.
 */
const DPOP_OTHER_ACCESS_TOKEN = "an-access-token-this-proof-was-not-presented-with";

/**
 * The DPoP proof a row presents — RFC 9449 §4.2 — signed at run time over the
 * token the GIVEN produced.
 *
 * Signed by the FOREIGN jose library for the same reason the foreign producers
 * exist: a presenter is by definition not the verifier, so a proof aegis both
 * wrote and read would show only that the two agree.
 *
 * The PUBLIC half of the key rides in the header as `jwk`, which is what the
 * verifier thumbprints against the token's `cnf.jkt`; the private half never
 * leaves this function.
 */
const signDpopProof = async (
  given: DpopProofGiven,
  presentedToken: string,
): Promise<string> => {
  const kryptos = KEY_FIXTURES[given.key];

  if (kryptos === undefined) {
    throw new Error(`the row presents a proof signed by the unknown key "${given.key}"`);
  }

  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  // RFC 9449 §4.2 — `ath` is the base64url SHA-256 of the ASCII access token the
  // proof is presented with.
  const committedToken = given.ath === "other" ? DPOP_OTHER_ACCESS_TOKEN : presentedToken;

  return new CompactSign(
    Buffer.from(
      JSON.stringify({
        jti: given.tokenId,
        htm: given.httpMethod,
        htu: given.httpUri,
        iat: Math.floor(Date.now() / 1000),
        ath: createHash("sha256").update(committedToken, "ascii").digest("base64url"),
      }),
      "utf8",
    ),
  )
    .setProtectedHeader({
      alg: kryptos.algorithm,
      typ: "dpop+jwt",
      jwk: kryptos.toJWK("public") as never,
    })
    .sign(key);
};

const materialise = async (
  artifact: ArtifactGivenStep,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<ScenarioResult> => {
  if (artifact.step === "claims") {
    // No artifact: the static surface operates on the flat dict directly.
    return { token: "", claims: artifact.claims };
  }

  switch (artifact.via) {
    case "mint": {
      // The ONE unavoidable cast, and it costs nothing: `MintGivenStep`
      // correlates `profile` with `content` per member, but at this call site
      // `artifact` is the whole union, and TypeScript cannot carry a per-member
      // correlation into `mint<P>(profile: P, content: ProfileContentFor<P>)` —
      // it infers `P` as the union of every name. The row itself is still checked
      // against its own member, which is where the typo guard lives.
      // A row that names no `format` is wire-agnostic; the RUN's wire decides
      // which claims format it mints as. A row that names one is pinned, and
      // `wiresOf` has already restricted the run to that wire, so the two can
      // never disagree.
      const signed = await ctx.aegis.mint(
        artifact.profile,
        mergeMintClaims(artifact.content as Dict) as never,
        {
          format: AGNOSTIC_FORMATS.mint[wire],
          ...artifact.options,
        } as never,
      );
      return { token: signed.token, format: signed.format };
    }

    case "kit-sign": {
      switch (artifact.kit) {
        case "structured": {
          const claims =
            wire === "cose" ? respellForCose(artifact.claims) : artifact.claims;
          const signed =
            AGNOSTIC_KITS.structured[wire] === "cwt"
              ? await ctx.aegis.cwt.sign(claims, artifact.options)
              : await ctx.aegis.jwt.sign(claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "opaque": {
          const signed =
            AGNOSTIC_KITS.opaque[wire] === "cws"
              ? await ctx.aegis.cws.sign(artifact.claims, artifact.options)
              : await ctx.aegis.jws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "jwt": {
          const signed = await ctx.aegis.jwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "cwt": {
          const signed = await ctx.aegis.cwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "jws": {
          const signed = await ctx.aegis.jws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "cws": {
          const signed = await ctx.aegis.cws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        default: {
          const exhaustive: never = artifact;
          throw new Error(`unhandled kit-sign artifact ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    case "kit-encrypt": {
      const kit = artifact.kit === "sealed" ? AGNOSTIC_KITS.sealed[wire] : artifact.kit;
      const encrypted =
        kit === "cwe"
          ? await ctx.aegis.cwe.encrypt(artifact.data, artifact.options)
          : await ctx.aegis.jwe.encrypt(artifact.data, artifact.options as never);
      return { token: encrypted.token, format: encrypted.format };
    }

    case "domain-encrypt": {
      const encrypted = await ctx.aegis.encrypt(artifact.data, {
        format: AGNOSTIC_FORMATS.encrypt[wire],
        ...artifact.options,
      } as never);
      return { token: encrypted.token, format: encrypted.format };
    }

    case "foreign": {
      const claims = wire === "cose" ? respellForCose(artifact.claims) : artifact.claims;
      const kryptos = KEY_FIXTURES[artifact.key ?? "ec-sig"];
      const typ = isString(artifact.typ) ? artifact.typ : artifact.typ?.[wire];

      return {
        token:
          wire === "cose"
            ? await signForeignCose(claims, typ, kryptos, artifact.coseBuckets)
            : await signForeignJose(claims, typ, kryptos, artifact.coseBuckets),
        // The producer emits a claims token on either wire; `format` is what the
        // READ side reports, and a foreign token is read exactly as an aegis one.
        // A shared secret makes the COSE structure a COSE_Mac0, which reads back
        // as `cwm` rather than `cwt`.
        format: wire === "cose" ? (kryptos.type === "oct" ? "cwm" : "cwt") : "jwt",
      };
    }

    default: {
      const exhaustive: never = artifact;
      throw new Error(`unhandled artifact ${JSON.stringify(exhaustive)}`);
    }
  }
};

/**
 * The member a tamper adds to a header or a claims container.
 *
 * Adding a member rather than editing one is deliberate: every parameter a token
 * already carries is load-bearing somewhere on the read path — changing `alg`
 * trips the algorithm match, changing `kid` makes the key unresolvable — and each
 * of those refusals arrives BEFORE the signature is checked, so the row would
 * pass while saying nothing about integrity. An unregistered member is inert on
 * both wires: RFC 7515 §4 leaves an unrecognised JOSE Header Parameter to be
 * ignored when it is not listed in `crit`, and an unregistered COSE label has no
 * JOSE wire name and is skipped
 * (`src/internal/header/cose-wire-header.ts#if (jose === undefined) return;`).
 */
const TAMPERED_MEMBER = "tampered";

/** Flip every bit of the last byte — a different value, the same length. */
const flipLastByte = (bytes: Buffer): Buffer => {
  if (bytes.length === 0) {
    throw new Error("the row tampers with an empty segment, so there is no byte to flip");
  }

  const copy = Buffer.from(bytes);
  copy[copy.length - 1] ^= 0xff;
  return copy;
};

const b64u = (value: Buffer | string): string =>
  (isString(value) ? Buffer.from(value, "utf8") : value).toString("base64url");

const tamperJose = (token: string, segment: TamperSegment): string => {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error(
      `the row tampers with a JOSE token, but a ${parts.length}-part serialisation has no header/payload/signature triple to rewrite`,
    );
  }

  const [header, payload, signature] = parts;

  switch (segment) {
    case "header": {
      const decoded = JSON.parse(
        Buffer.from(header, "base64url").toString("utf8"),
      ) as Dict;
      return [
        b64u(JSON.stringify({ ...decoded, [TAMPERED_MEMBER]: true })),
        payload,
        signature,
      ].join(".");
    }

    case "payload": {
      const decoded = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Dict;
      return [
        header,
        b64u(JSON.stringify({ ...decoded, [TAMPERED_MEMBER]: true })),
        signature,
      ].join(".");
    }

    case "signature":
      return [
        header,
        payload,
        b64u(flipLastByte(Buffer.from(signature, "base64url"))),
      ].join(".");

    default: {
      const exhaustive: never = segment;
      throw new Error(`unhandled tamper segment "${String(exhaustive)}"`);
    }
  }
};

const tamperCose = (token: string, segment: TamperSegment): string => {
  let value: unknown = decodeCbor(Buffer.from(token, "base64url"));
  const tags: Array<number> = [];

  while (value instanceof Tag) {
    tags.push(Number(value.tag));
    value = value.contents;
  }

  if (!isArray(value)) {
    throw new Error(
      "the row tampers with a COSE token, but the CBOR does not decode to a COSE structure array",
    );
  }

  const structure = [...value];

  switch (segment) {
    case "header": {
      const header = decodeProtectedHeader(structure[0] as Uint8Array);
      // The label is a tstr, which RFC 9052 §1.5 admits (`label = int / tstr`)
      // alongside the integer labels the bucket already carries. The map is typed
      // `Map<number, unknown>` because every label aegis WRITES is an integer.
      (header as Map<number | string, unknown>).set(TAMPERED_MEMBER, true);
      structure[0] = encodeCbor(header);
      break;
    }

    case "payload": {
      const payload = decodeCbor<Map<number | string, unknown>>(
        structure[2] as Uint8Array,
      );
      payload.set(TAMPERED_MEMBER, true);
      structure[2] = encodeCbor(payload);
      break;
    }

    case "signature": {
      if (structure.length < 4) {
        throw new Error(
          `the row tampers with a COSE signature, but a ${structure.length}-element structure carries none (a COSE_Encrypt0 has ciphertext, not a signature)`,
        );
      }
      structure[3] = flipLastByte(Buffer.from(structure[3] as Uint8Array));
      break;
    }

    default: {
      const exhaustive: never = segment;
      throw new Error(`unhandled tamper segment "${String(exhaustive)}"`);
    }
  }

  // Re-frame in the tag chain the token arrived in, INNERMOST first. A CWT is
  // `Tag(61, Tag(18, …))` (RFC 8392 §6), and a token that came back untagged
  // would otherwise stop being the structure the read side routes on.
  let rewrapped: unknown = structure;

  for (const tag of [...tags].reverse()) {
    rewrapped = new Tag(tag, rewrapped);
  }

  return encodeCbor(rewrapped).toString("base64url");
};

/**
 * Rewrite the built artifact, when the row's artifact step asks for it.
 *
 * Runs OUTSIDE the outcome's try/catch on EVERY path (see {@link runScenario}),
 * including the one where the construction is itself the act, so a tamper that
 * cannot be applied surfaces as the harness's own diagnostic rather than as the
 * rejection the row expects — a row asserting "the altered token is refused"
 * would otherwise pass on the alteration having failed to happen.
 */
const applyTamper = (
  result: ScenarioResult,
  artifact: ArtifactGivenStep,
): ScenarioResult => {
  if (artifact.step !== "token" || artifact.tamper === undefined) return result;

  const { segment } = artifact.tamper;

  return {
    ...result,
    token: result.token.includes(".")
      ? tamperJose(result.token, segment)
      : tamperCose(result.token, segment),
  };
};

/**
 * Which verify arity a step asked for. A predicate rather than an inline
 * `when.profile ? …`, so both branches keep their own OPTIONS type: the profiled
 * call is handed `ProfileVerifyOptions` (mandatory `audience`), the plain one
 * `VerifyOptions`.
 */
const isProfiledVerify = (
  step: PlainVerifyStep | ProfiledVerifyStep,
): step is ProfiledVerifyStep => step.profile !== undefined;

const act = async (
  step: WhenStep,
  current: ScenarioResult,
  artifact: ArtifactGivenStep,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<ScenarioResult> => {
  switch (step.step) {
    // The GIVEN's own construction is the act; `materialise` already ran it.
    case "mint":
      return current;

    case "parse": {
      const parsed = ctx.aegis.parse(current.token);
      return {
        token: current.token,
        format: parsed.format,
        claims: parsed.claims as Dict,
        custom: parsed.custom as Dict,
        header: parsed.header as unknown as Dict,
        buckets: {
          value: {
            profile: parsed.profile as Dict | undefined,
            sensitive: parsed.sensitive as Dict | undefined,
            delegation: parsed.delegation as unknown as Dict | undefined,
          },
        },
      };
    }

    case "verify": {
      // The proof is signed HERE, over the artifact the GIVEN just produced:
      // RFC 9449 §4.2 makes `ath` commit to the access token it is presented
      // with, so a conformant proof does not exist until the token does and no
      // row could hold a finished one. The bag is left EXACTLY as the row wrote
      // it when no proof is presented — an `options` the row omitted stays
      // omitted rather than becoming a bag carrying `dpopProof: undefined`.
      const dpopProof =
        step.dpopProof === undefined
          ? undefined
          : await signDpopProof(step.dpopProof, current.token);

      // ⚠ FOUR positionals on the profiled overload — `assert` is the THIRD slot,
      // options the FOURTH. Options in the third slot become claim MATCHERS.
      const verified = isProfiledVerify(step)
        ? await ctx.aegis.verify(
            step.profile,
            current.token,
            step.assert,
            dpopProof === undefined ? step.options : { ...step.options, dpopProof },
          )
        : await ctx.aegis.verify(
            current.token,
            step.assert,
            dpopProof === undefined ? step.options : { ...step.options, dpopProof },
          );

      return {
        token: verified.token,
        format: verified.format,
        claims: verified.claims as Dict,
        custom: verified.custom as Dict,
        header: verified.header as unknown as Dict,
        raw: { value: verified.raw },
        wire: { value: verified.wire?.payload },
        buckets: {
          value: {
            profile: verified.profile as Dict | undefined,
            sensitive: verified.sensitive as Dict | undefined,
            delegation: verified.delegation as unknown as Dict | undefined,
          },
        },
        dpop: { value: verified.dpop },
      };
    }

    case "kit-verify": {
      // A wire-agnostic kit name resolves against the wire the run is on, the
      // same table `materialise` signs through — so the door a row names is the
      // door for the artifact it built, on every wire it runs on.
      const kit =
        step.kit === "structured" || step.kit === "opaque"
          ? AGNOSTIC_KITS[step.kit][wire]
          : step.kit;

      // An OPAQUE door takes `VerifyUnstructuredTokenOptions`, which has no
      // temporal knob at all — there are no claims to bound. A row that stated
      // one here would be asserting against an option the door does not have, so
      // name the mistake rather than forward a bag that is silently ignored.
      if (step.options !== undefined && (kit === "jws" || kit === "cws")) {
        throw new Error(
          `the row hands verify options to the ${kit} door, which takes none beyond \`certBindingMode\` — an opaque token carries no claims layer to bound.`,
        );
      }

      switch (kit) {
        case "jwt": {
          const result = await ctx.aegis.jwt.verify(
            current.token,
            undefined,
            step.options,
          );
          return {
            token: current.token,
            claims: result.payload as Dict,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "cwt": {
          const result = await ctx.aegis.cwt.verify(
            current.token,
            undefined,
            step.options,
          );
          return {
            token: current.token,
            claims: result.payload as Dict,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "jws": {
          const result = await ctx.aegis.jws.verify(current.token);
          return {
            token: current.token,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "cws": {
          const result = await ctx.aegis.cws.verify(current.token);
          return {
            token: current.token,
            header: result.protectedHeader as unknown as Dict,
          };
        }

        // ⚠ `noFallthroughCasesInSwitch` and `noImplicitReturns` are BOTH off
        // repo-wide, so without this an unmatched kit fell out of this switch and
        // straight into `case "decrypt"` below — the row would have believed it
        // was testing the kit-verify door while `aegis.decrypt` ran.
        default: {
          const exhaustive: never = kit;
          throw new Error(`unhandled kit-verify door "${String(exhaustive)}"`);
        }
      }
    }

    case "decrypt": {
      const decrypted = await ctx.aegis.decrypt(current.token, step.options);
      return {
        token: current.token,
        format: decrypted.format,
        // `decrypt` reports ONE header — the encrypting outer's, which the AEAD
        // covers in full. There is no unprotected counterpart to report, so the
        // cell is left unset rather than filled with an empty bucket.
        header: decrypted.header as unknown as Dict,
        // …and ONE payload, in the `raw` cell, because that is the cell for a
        // value reported as itself. The claim cells are left UNSET rather than
        // filled with `{}`: `decrypt` has no claims layer at all, and an empty
        // bucket would let a row assert "no claims were established" against a
        // verb that could never establish any — a vacuous pass.
        raw: { value: decrypted.payload },
      };
    }

    case "static-assert": {
      if (artifact.step !== "claims") {
        throw new Error(
          `static-assert requires a { step: "claims" } GIVEN, received a "${artifact.via}" token`,
        );
      }
      // BOTH forms of the static matcher run, over the same claims, the same
      // matcher and the same options — `Aegis.matches` answers the question and
      // `Aegis.assert` throws it.
      //
      // ⚠ WHAT THE AGREEMENT PINS is argument FORWARDING and POLARITY, never
      // matching semantics. The two share more than the predicate builder: they
      // share the MATCHER, because `validate`
      // (`src/internal/utils/validate.ts#if (matches(dict, predicate)) return;`)
      // opens with `if (matches(dict, predicate)) return;` — the same call
      // `Aegis.matches` makes. So a matcher that decided every claim set wrongly
      // would keep the two in perfect agreement. What cannot survive is one form
      // dropping an argument the other forwards, or inverting the answer. The
      // SEMANTICS are pinned by each row's own declared verdict, which is an
      // independent statement about what the matcher must decide.
      const matched = Aegis.matches(artifact.claims, step.assert, step.options);

      try {
        Aegis.assert(artifact.claims, step.assert, step.options);
      } catch (error) {
        expect(
          matched,
          "Aegis.assert refused these claims, so Aegis.matches must answer false for them",
        ).toBe(false);
        throw error;
      }

      expect(
        matched,
        "Aegis.assert accepted these claims, so Aegis.matches must answer true for them",
      ).toBe(true);

      return { token: "", claims: artifact.claims };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`unhandled act ${JSON.stringify(exhaustive)}`);
    }
  }
};

/**
 * THEN — one observable consequence per step, asserted in the order written.
 *
 * The verdict is the FIRST step (the tuple type enforces it), so this is called
 * with the verdict already settled: an `accepts` row that threw has rethrown, and
 * a `rejects` row never reaches an observation.
 */
const assertObservation = (step: ThenStep, result: ScenarioResult, wire: Wire): void => {
  // An observation scoped to another wire is not this run's business. Skipping
  // it is the whole reason a raw-label assertion does not pin the ROW to one
  // wire — see `ObservationThenStep.on`.
  if (step.step !== "accepts" && step.step !== "rejects" && step.on !== undefined) {
    if (step.on !== wire) return;
  }

  switch (step.step) {
    case "accepts":
      if (step.format !== undefined) {
        // A bare tag claims the SAME format on every wire the row runs on. That
        // is only ever true of a one-wire row, so on any other wire it would be
        // asserting a JOSE tag against a COSE run — refuse it by name rather
        // than let it fail as a puzzling value mismatch three lines down.
        if (isString(step.format)) {
          expect(
            result.format,
            `the row states one format for every wire it runs on; on the ${wire} wire that cannot hold. State it per wire: { ${wire}: "…" }`,
          ).toBe(step.format);
          return;
        }

        const expected = step.format[wire];

        expect(
          expected,
          `the row states a per-wire format but names none for the ${wire} wire it runs on`,
        ).toBeDefined();
        expect(result.format).toBe(expected);
      }
      return;

    case "claims":
      expect(result.claims).toMatchObject(step.expected);
      for (const field of step.excludes ?? []) {
        // The bucket itself must exist first: `not.toHaveProperty` over
        // `undefined` passes, so an exclusion asserted against an act that
        // produced no claim bucket would check nothing.
        expect(
          result.claims,
          "the row excludes a domain claim, but the act produced no claim bucket",
        ).toBeDefined();
        expect(result.claims).not.toHaveProperty(field);
      }
      return;

    case "custom":
      expect(result.custom).toMatchObject(step.expected);
      for (const field of step.excludes ?? []) {
        expect(
          result.custom,
          "the row excludes a custom claim, but the act produced no custom bucket",
        ).toBeDefined();
        expect(result.custom).not.toHaveProperty(field);
      }
      return;

    case "raw": {
      const raw = cellOf(result.raw, "the opaque payload", "`verify` and `decrypt`");

      expect(
        raw,
        "the row asserts on the opaque payload, but the act delivered none",
      ).toBeDefined();

      // A string payload is compared WHOLE. `toMatchObject` over a string
      // compares character by character and would be satisfied by a prefix, so
      // the two shapes are not interchangeable.
      if (isString(step.expected)) {
        expect(raw).toBe(step.expected);
        return;
      }

      expect(raw).toMatchObject(step.expected);

      for (const field of step.excludes ?? []) {
        expect(raw).not.toHaveProperty(field);
      }
      return;
    }

    case "untranslatedClaims": {
      const wire = cellOf(
        result.wire,
        "the untranslated wire claims",
        "`verify` and `decrypt`",
      );

      expect(
        wire,
        "the row asserts on the untranslated wire claims, but the act passed none through",
      ).toBeDefined();
      expect(wire).toMatchObject(step.expected);
      return;
    }

    case "bucket": {
      const buckets = cellOf(
        result.buckets,
        `the ${step.bucket} bucket`,
        "`parse` and `verify`",
      );
      const bucket = buckets[step.bucket];

      if (step.absent === true) {
        // `toBeUndefined`, not `toEqual({})`: an empty bucket is TRUTHY, so a
        // consumer's `if (result.sensitive)` would read one as populated.
        expect(bucket).toBeUndefined();
        return;
      }

      expect(
        bucket,
        `the row asserts on the contents of the ${step.bucket} bucket, but the result carries none`,
      ).toBeDefined();
      expect(bucket).toMatchObject(step.expected);
      return;
    }

    case "wireStructure": {
      const inspection = inspectToken(result.token);

      if (step.tags !== undefined) {
        if (inspection.wire !== "cose") {
          throw new Error(
            "the row asserts a CBOR tag chain, but the token is a JOSE compact serialisation, which has none. " +
              'Scope the step with `on: "cose"`, or assert `parts` instead.',
          );
        }
        expect(inspection.tags).toEqual(step.tags);
        return;
      }

      if (inspection.wire !== "jose") {
        throw new Error(
          "the row asserts a compact-serialisation part count, but the token is a COSE structure, which has no parts. " +
            'Scope the step with `on: "jose"`, or assert `tags` instead.',
        );
      }
      expect(inspection.partCount).toBe(step.parts);
      return;
    }

    case "header":
      expect(result.header).toMatchObject(step.expected);
      for (const field of step.excludes ?? []) {
        expect(result.header).not.toHaveProperty(field);
      }
      return;

    case "wirePayload": {
      // ⚠ `payload`, not `wire` — this used to SHADOW the `wire: Wire` parameter,
      // so every mention of the run's wire inside this branch would have read a
      // `WirePayload` instead.
      const payload = readWirePayload(result.token, result.format);

      // A wire assertion against a payload that cannot be read is VACUOUS, not
      // satisfied — an exclusion over an empty dict can never fail, so a row could
      // claim "the value never reached the wire" without ever looking. Fail it.
      if (payload.readable === false) {
        throw new Error(
          `the row asserts on the cleartext wire payload, but ${payload.reason}. ` +
            "Assert `format` instead, or drop the wire assertion — it cannot be checked here.",
        );
      }

      if (step.includes) {
        expect(payload.payload).toMatchObject(step.includes);
      }
      for (const key of step.excludes ?? []) {
        expect(payload.payload).not.toHaveProperty(key);
      }
      return;
    }

    // The RAW-BYTES steps. They read the token through the INDEPENDENT inspector,
    // which imports nothing from `internal/` or `classes/` — so unlike every
    // other wire assertion here, they cannot be satisfied by a mint bug and a read
    // bug that agree with each other.
    case "wireProtectedHeader":
      assertWireBucket(step, wireBucketOf(inspectToken(result.token), "protectedHeader"));
      return;

    case "wireUnprotectedHeader": {
      const inspection = inspectToken(result.token);

      if (step.absent === true) {
        expect(
          inspection.unprotectedHeader,
          "expected the wire to carry no unprotected header bucket at all",
        ).toBeUndefined();
        return;
      }

      assertWireBucket(step, wireBucketOf(inspection, "unprotectedHeader"));
      return;
    }

    case "wireClaims":
      assertWireBucket(step, wireBucketOf(inspectToken(result.token), "claims"));
      return;

    case "dpop": {
      // The cell, not the value: an act that reports NO proof at all is a row
      // asserting the possession check ran when it never did — the precise shape
      // of the gap this step exists to close, so it fails by name.
      if (result.dpop === undefined) {
        throw new Error(
          "the row asserts on the verified proof of possession, but the last act reported none. " +
            "Only a `verify` handed a `dpopProof` produces one.",
        );
      }

      const dpop = result.dpop.value;

      expect(
        dpop,
        "the row asserts a proof was verified, but the result carries none — the possession check did not run",
      ).toBeDefined();
      if (dpop === undefined) return;

      expect(dpop).toMatchObject(step.expected);

      // The two DERIVED facts, asserted on EVERY such row rather than left to a
      // row to remember, because they ARE the check: that the proof was made by
      // the key the token names, and made for the token actually presented.
      // A row can state neither — the thumbprint is the bound key's digest and
      // the hash is over the token the row itself produced.
      //
      // ⚠ Recomputed here from the token and the wire's own `cnf`, NOT read back
      // out of the same result: comparing the result to itself would be
      // satisfied by a verifier that fabricated both.
      const boundThumbprint = confirmationThumbprintOf(result.token);

      expect(
        boundThumbprint,
        "the row asserts a proof of possession, but the token it produced carries no confirmation to be bound to",
      ).toBeDefined();
      expect(dpop.thumbprint).toBe(boundThumbprint);

      // RFC 9449 §4.2 — `ath` is the base64url SHA-256 of the ASCII access token.
      expect(dpop.accessTokenHash).toBe(
        createHash("sha256").update(result.token, "ascii").digest("base64url"),
      );
      return;
    }

    case "rejects":
      // Unreachable via the tuple type: a THEN holding a rejection holds nothing
      // but rejections, and `assertOutcome` never reaches the observation loop
      // for one.
      throw new Error("a `rejects` step is a verdict, never an observation");

    default: {
      const exhaustive: never = step;
      throw new Error(`unhandled observation ${JSON.stringify(exhaustive)}`);
    }
  }
};

/**
 * The rejection verdict that applies to THIS run — the one scoped to the wire if
 * the row states one, otherwise the unscoped one.
 *
 * `undefined` means the row states per-wire verdicts and covers every wire but
 * this one. That is a row asserting nothing on a wire it runs on, so the caller
 * fails it by name rather than letting the run pass on a missing expectation.
 */
const rejectionFor = (
  then: Scenario["then"],
  wire: Wire,
): RejectsThenStep | undefined => {
  const verdicts = then.filter(
    (step): step is RejectsThenStep => step.step === "rejects",
  );

  return (
    verdicts.find((step) => step.on === wire) ??
    verdicts.find((step) => step.on === undefined)
  );
};

/** The wire a THEN step scopes itself to. `accepts` carries no scope at all. */
const scopedWireOf = (step: ThenStep): Wire | undefined =>
  step.step === "accepts" ? undefined : step.on;

/**
 * Refuse a row that scopes a THEN step to a wire it does not RUN on.
 *
 * Such a step asserts NOTHING, on every wire: the run it names never happens, and
 * on the runs that do happen `assertObservation` skips it by name. So a row could
 * state its whole consequence under `on: "cose"`, declare `unsupported.cose`, and
 * pass everywhere having checked nothing.
 *
 * ⚠ The other two per-wire mechanisms already guard their own version of this —
 * `rejectionFor` fails a wire no verdict covers, and a per-wire `accepts.format`
 * fails a wire it names no tag for. This is the third, and it was the one left
 * silent.
 */
const assertScopesAreRun = (scenario: Scenario): void => {
  const running = wiresOf(scenario);

  const stranded = scenario.then
    .map(scopedWireOf)
    .filter((on): on is Wire => on !== undefined && !running.includes(on));

  if (stranded.length === 0) return;

  throw new Error(
    `the row scopes a THEN step to the ${stranded.join(", ")} wire, which it does not run on — ` +
      "that step asserts nothing. Drop the step, or drop the `unsupported` entry that removed the wire.",
  );
};

const assertOutcome = (
  then: Scenario["then"],
  result: ScenarioResult | undefined,
  error: unknown,
  wire: Wire,
): void => {
  const [first] = then;

  if (first.step === "rejects") {
    const verdict = rejectionFor(then, wire);

    if (verdict === undefined) {
      throw new Error(
        `the row states its rejection per wire but names none for the ${wire} wire it runs on`,
      );
    }

    // Name what it resolved TO when it should have thrown: "it resolved" alone
    // does not say whether the check ran and passed or never ran at all.
    const resolved = result
      ? ` — it RESOLVED to ${JSON.stringify({
          format: result.format,
          claims: result.claims,
        })}`
      : "";

    expect(
      error,
      `expected the scenario to REJECT with ${verdict.error}${resolved}`,
    ).toBeInstanceOf(ERROR_CLASSES[verdict.error]);

    if (verdict.data) {
      expect(error).toMatchObject({ data: verdict.data });
    }
    return;
  }

  // Rethrow rather than assert: the real failure message is far more useful than
  // "expected undefined to have property claims".
  if (error !== undefined) throw error;
  if (!result) throw new Error("scenario produced neither a result nor an error");

  for (const step of then) {
    assertObservation(step, result, wire);
  }
};

/**
 * Run one row: apply the setup steps, build the artifact, perform every act in
 * order, assert every consequence.
 *
 * The GIVEN's construction runs OUTSIDE the outcome's try/catch unless the first
 * act is `mint`, where the construction IS the act — otherwise a setup that
 * happened to throw would masquerade as the rejection the row expects.
 *
 * ⚠ A leading `mint` makes the construction the FIRST act, not the only one. The
 * remaining acts run inside the SAME try, so `[{ mint }, { verify }]` reads and
 * behaves as "mint AND THEN verify". Returning after the construction instead —
 * which the type system permits, since `When` is a non-empty tuple and `act` has
 * a `mint` branch — would silently drop every later act and assert the mint alone.
 */
export const runScenario = async (
  original: Scenario,
  ctx: ScenarioContext,
  wire: Wire,
): Promise<void> => {
  // ⚠ CLONE FIRST, reviving every date cell. The table is a module-level literal
  // and every row runs at least twice — once per wire, and again for the defect
  // check — so anything downstream that writes into a step would leak across
  // those runs. The revival is what lets a row carry a `Date` at all.
  const scenario = reviveCells(original);

  assertScopesAreRun(scenario);

  applySetup(scenario.given, ctx);

  const artifact = artifactStepOf(scenario.given);
  const constructionIsTheAct = scenario.when[0].step === "mint";

  let result: ScenarioResult | undefined;
  let error: unknown;
  let built: ScenarioResult | undefined;

  // A `mint` row's ACT is the construction itself, so a build that throws IS the
  // verdict and has to be caught. Every other row builds its artifact as a
  // GIVEN, where a throw is the harness failing to set the world up and must
  // surface as itself rather than as the refusal the row asserts.
  if (constructionIsTheAct) {
    try {
      built = await materialise(artifact, ctx, wire);
    } catch (err) {
      error = err;
    }
  } else {
    built = await materialise(artifact, ctx, wire);
  }

  if (built !== undefined) {
    // ⚠ OUTSIDE every try, on BOTH paths. A tamper that cannot be applied is the
    // harness's own failure, and a row asserting "the altered token is refused"
    // would otherwise pass on the alteration never having happened. The mint
    // path used to run it inside the catch, which is exactly that hole.
    let current = applyTamper(built, artifact);

    try {
      for (const step of constructionIsTheAct ? scenario.when.slice(1) : scenario.when) {
        current = await act(step, current, artifact, ctx, wire);
      }
      result = current;
    } catch (err) {
      error = err;
    }
  }

  assertOutcome(scenario.then, result, error, wire);
};
