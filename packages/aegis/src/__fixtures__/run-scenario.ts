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
import { createHash, subtle } from "node:crypto";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { LindormError } from "@lindorm/errors";
import { isArray, isDate, isNull, isObject, isString, isUndefined } from "@lindorm/is";
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
import {
  CLAIM_SPECS,
  coseLabel,
  coseName,
  joseName,
} from "../internal/claims/claims-registry.js";
import { B64U } from "../internal/constants/format.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { encodeCwtClaims } from "../internal/cose/cwt-claims.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { decodeCwtWire } from "../internal/cose/decode-cwt-wire.js";
import { COSE_TAG, decodeProtectedHeader } from "../internal/cose/structures.js";
import { coseByJose, headerByJose } from "../internal/header/header-registry.js";
import { WIRE_TAGS } from "../internal/registry/wire.js";
import type {
  CoseHeaderBuckets,
  CoseWireTokenEnvelope,
  JoseHeaderBuckets,
  ParsedDpopProof,
  TokenContent,
  TokenFormat,
  TokenFormatTag,
  VerifyStructuredTokenOptions,
  VerifyUnstructuredTokenOptions,
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
  type AgnosticCustom,
  type ArtifactGivenStep,
  type ForeignHeadersGiven,
  type ForgedClaim,
  type ForgedMember,
  type ForgedSignature,
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

const ERROR_CLASSES: Record<ErrorClassName, typeof LindormError | ErrorConstructor> = {
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
  TypeError,
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

    // A FORGED token is the opposite: it names an encoding and nothing else, so
    // the wire is the step's own declaration. The row owes the other wire an
    // `unsupported` reason like any other pinned artifact.
    case "forged":
      return artifact.wire;

    case "mint":
    case "domain-encrypt": {
      const format = artifact.options?.format;
      if (!isString(format)) return undefined;
      return format.startsWith("c") ? "cose" : "jose";
    }

    // `aegis.sign` names no format in a row — the run's wire resolves the claims
    // pair (`jwt` / `cwt`), so a row is agnostic. There is no opaque pair to
    // resolve: the verb is claims-only, and an opaque signature is
    // `via: "kit-sign", kit: "opaque"`.
    case "domain-sign":
      return undefined;

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
  /** The envelope the act reported, when the artifact arrived in one. */
  wrapper?: string;
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
  /**
   * The WIRE-tier `custom` header bags, in a cell for the same reason as the
   * rest: only a KIT door reports them. The DOMAIN verbs report none — an
   * unregistered wire parameter has no domain name — so a row asserting on this
   * against `verify`/`decrypt` fails BY NAME rather than passing on the verb's
   * silence, which is exactly the tier boundary stated as a test.
   *
   * ⚠ THE TWO WIRES REPORT DIFFERENT SHAPES and the union is what keeps that
   * honest: JOSE reports ONE bucket, COSE two. {@link customBucketOf} resolves a
   * row's bucket against whichever ran, and REFUSES the pair that has no meaning.
   */
  customHeader?: {
    value: JoseHeaderBuckets["custom"] | CoseHeaderBuckets["custom"] | undefined;
  };
  /**
   * The WIRE protected header a KIT door reports, in a cell of its own — see the
   * `wireHeader` THEN step. A DOMAIN act reports none, so a row asserting on it
   * after `verify`/`parse` fails by name rather than silently comparing a domain
   * header against wire spellings.
   */
  wireHeader?: { value: Dict };
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
 * ⚠ `has` takes the raw key: a lookup that stringified its key would merge the
 * integer label `4` with the text label `"4"` — two different parameters.
 * RFC 9052 §1.5. The RECORD is stringified because that
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

      // The public door a consumer extends the profile vocabulary through. It
      // writes into the CURRENT deployment's own registry, so a row that also
      // rebuilds the deployment states this step after it.
      case "profile":
        ctx.aegis.registerProfile(step.profile);
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
 * A wire-agnostic row's custom bag, re-spelled for COSE — the twin of
 * {@link respellForCose} in BOTH direction and reason. The row is written in the
 * JOSE spelling and the interpreter re-spells for COSE, which is the one
 * convention the agnostic steps state ({@link AgnosticCustom}); only the bucket's
 * NAME differs, so the entries cross verbatim.
 *
 * ⚠ `unprotected` is COSE-only and passes through untouched — there is no JOSE
 * bucket it could have been re-spelled from. {@link joseOptionsOf} is the other
 * half of that rule.
 */
const coseCustomOf = (
  custom: AgnosticCustom | undefined,
): CoseWireTokenEnvelope["custom"] => {
  if (isUndefined(custom)) return undefined;

  const { header, ...rest } = custom;

  return isUndefined(header) ? rest : { ...rest, protected: header };
};

/**
 * A wire-agnostic row's options on the JOSE leg — passed through, having REFUSED
 * the COSE-only bucket.
 *
 * ⚠ THE REFUSAL IS THE POINT, and a type cannot make it. `AgnosticCustom` shares
 * `header` with the JOSE envelope's custom bag
 * (`src/types/header/wire-envelope.ts#export type JoseWireTokenEnvelope`), so a row
 * carrying `unprotected` is ASSIGNABLE to a JOSE door and the bucket would drop
 * SILENTLY.
 * This says the same thing {@link signForeignJose} says about a foreign row's
 * unprotected bucket, for the same reason: signing a token that ignores half the
 * row tests nothing.
 */
const joseOptionsOf = <T extends { custom?: AgnosticCustom }>(
  options: T | undefined,
): T | undefined => {
  if (isUndefined(options?.custom?.unprotected)) return options;

  throw new Error(
    "the row places parameters in the UNPROTECTED custom bucket, but this run is on the JOSE wire, whose compact serialisation has only one header. " +
      "Scope the row with `unsupported: { jose: … }`.",
  );
};

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

/** The format a wire-agnostic `mint` / `domain-sign` / `domain-encrypt` resolves to. */
const AGNOSTIC_FORMATS = {
  mint: { jose: "jwt", cose: "cwt" },
  // `cwm` is absent because a COSE_Mac0 needs a symmetric key (RFC 9052 §6.2) and
  // an agnostic row states no key, so it would not be the COSE twin of `jwt` but
  // a different artifact.
  sign: { jose: "jwt", cose: "cwt" },
  encrypt: { jose: "jwe", cose: "cwe" },
} as const satisfies Record<"mint" | "sign" | "encrypt", Record<Wire, string>>;

/**
 * The verify options a STRUCTURED door takes and an OPAQUE one does not — every
 * one of them a CLAIMS knob, and an opaque token carries no claims layer to
 * apply it to.
 *
 * ⚠ THE KEY TYPE IS THE DIFFERENCE BETWEEN THE TWO OPTION BAGS, not a
 * transcription of it, and the compiler holds it to that in BOTH directions: a
 * knob added to the STRUCTURED bag alone enters the `Exclude` and this object
 * fails to compile for the missing property, and a structured knob PROMOTED to
 * the shared bag leaves its entry here excess. Hand-kept, the first of those
 * would reach the opaque door with nothing to notice.
 *
 * ⛔ A knob added to the UNSTRUCTURED bag — alone, or to both at once — changes
 * the `Exclude` not at all, and that is correct rather than a hole: a door that
 * DECLARES the knob is a door this guard has no objection to. The guard's
 * subject is the difference, so an option on both sides is outside it.
 */
const STRUCTURED_ONLY_VERIFY_OPTIONS: Readonly<
  Record<
    Exclude<keyof VerifyStructuredTokenOptions, keyof VerifyUnstructuredTokenOptions>,
    true
  >
> = {
  clockTolerance: true,
  currentDate: true,
  maxTokenAge: true,
  tokenType: true,
  verifyAuthTime: true,
  verifyExpiration: true,
  verifyIssuedAt: true,
  verifyNotBefore: true,
};

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
 * re-signed. The `kid` rides the UNPROTECTED bucket, which is where aegis's key
 * resolution reads it from. RFC 9052 §3.1.
 */
const webCryptoSignParams = (kryptos: IKryptos): EcdsaParams => {
  switch (kryptos.algorithm) {
    // ES512 maps to P-521 with SHA-512, and the JWS signature is the raw
    // `R || S` pair `subtle.sign` already returns. RFC 7518 §3.4.
    case "ES512":
      return { name: "ECDSA", hash: "SHA-512" };
    default:
      throw new Error(
        `the hand-assembled foreign JOSE producer has no WebCrypto mapping for "${kryptos.algorithm}" — add one`,
      );
  }
};

/**
 * A JOSE compact serialisation assembled BY HAND — the producer path for a header
 * `jose` refuses to write (see the caller for which one and why).
 *
 * ⚠ THE SIGNATURE IS REAL: `subtle.sign` over the exact
 * `BASE64URL(header) "." BASE64URL(payload)` signing input (RFC 7515 §5.1), with
 * the key `jose` would have used. ⛔ NOT because today's callers need it —
 * every JOSE reader runs `assertProtectedHeaderGates` BEFORE its signature or
 * AEAD cycle (`JwsKit.verify`, `JwtKit.verify`, `JweKit.decrypt`), so a garbage
 * signature would not change the verdict of a row taking this path.
 * It is real because a hostile-header producer that also forged the signature
 * models nothing (a third party's envelope is odd, its signature is not), and
 * because a row whose verdict DOES come after the signature must be able to take
 * this path without the helper changing underneath it. Pinned by
 * `run-scenario.test.ts#a hand-assembled compact serialisation carries a
 * signature aegis verifies`.
 *
 * Exported for that pin alone: the routing above reaches this only for a header
 * aegis refuses on sight, so no scenario row can exercise the signature.
 */
export const signCompactByHand = async (
  header: Dict,
  payload: Buffer,
  kryptos: IKryptos,
  key: Awaited<ReturnType<typeof importJWK>>,
): Promise<string> => {
  if (!(key instanceof CryptoKey)) {
    throw new Error(
      "the hand-assembled foreign JOSE producer signs with WebCrypto, which needs an imported CryptoKey — this row's key resolved to raw bytes.",
    );
  }

  const signingInput = `${B64.encode(JSON.stringify(header), B64U)}.${B64.encode(payload, B64U)}`;

  const signature = await subtle.sign(
    webCryptoSignParams(kryptos),
    key,
    Buffer.from(signingInput, "utf8"),
  );

  return `${signingInput}.${B64.encode(Buffer.from(signature), B64U)}`;
};

/**
 * The custom bag a row's BUCKET names, on whichever wire ran.
 *
 * A row states the COSE bucket spelling on both wires (the `customHeader` step in
 * `scenarios.ts`), and JOSE names its ONE bucket `header` —
 * compact JWS/JWE carry a single header and it is integrity-protected
 * (`src/types/header/wire-buckets.ts#export type JoseHeaderBuckets`) — so `protected` reads it.
 *
 * ⚠ `unprotected` THROWS on a JOSE run rather than answering an empty bag: an
 * `excludes`-only assertion over `{}` can never fail, so the row would report a
 * pass having looked at nothing. Same refusal, same reason as
 * {@link signForeignJose} on a foreign row's unprotected bucket.
 */
const customBucketOf = (
  bags: JoseHeaderBuckets["custom"] | CoseHeaderBuckets["custom"],
  bucket: "protected" | "unprotected",
): Record<string, unknown> => {
  // `in`, not `Object.hasOwn`: the key is this file's own literal from a CLOSED
  // list, never a token's, and it is what narrows the union.
  if (!("header" in bags)) return bags[bucket];

  if (bucket === "unprotected") {
    throw new Error(
      "the row asserts on the UNPROTECTED custom header bucket, but this run is on the JOSE wire, whose compact serialisation has only one header. " +
        "Scope the row with `unsupported: { jose: … }`.",
    );
  }

  return bags.header;
};

const signForeignJose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  buckets: ForeignHeadersGiven | undefined,
): Promise<string> => {
  // A JOSE compact serialisation has ONE header (RFC 7515 §7.1) and no second
  // bucket to place a parameter in, so a row that names the UNPROTECTED one has
  // no meaning here. Say so rather than sign a token that quietly ignores half
  // the row. The PROTECTED half applies on both wires and is written below.
  if (buckets?.unprotectedHeader !== undefined) {
    throw new Error(
      "the row places parameters in the UNPROTECTED header bucket, but this run is on the JOSE wire, whose compact serialisation has only one header. " +
        "Scope the row with `unsupported: { jose: … }`.",
    );
  }

  // Same guard, same reason: a JOSE header is a JSON object with ONE name-space,
  // so the second label form (RFC 9052 §1.5) has no meaning here and this builder
  // has nowhere to put the entries. Without the throw the field is silently dropped
  // and the row signs a token that tests nothing.
  if (buckets?.textLabelledProtected !== undefined) {
    throw new Error(
      "the row places TEXT-LABELLED protected entries, but this run is on the JOSE wire, whose header has a single name-space — there is no second label form for them to take. " +
        "Scope the row with `unsupported: { jose: … }`.",
    );
  }

  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  const protectedHeader = buckets?.protectedHeader ?? {};

  // ⚠ THE FOREIGN LIBRARY ENFORCES `crit` ON ITS OWN PRODUCER SIDE, and refuses
  // to sign a header naming an extension it has not been told it implements
  // (`JOSENotSupported: Extension Header Parameter "ext" is not recognized`).
  // That is RFC 7515 §4.1.11 read from the writing end, and `jose`'s `crit`
  // option is how a producer declares the extensions it does implement. Deriving
  // the declaration from the row's own `crit` is what makes this a CONFORMANT
  // third party shipping an extension rather than a malformed token: the point
  // of the rows using it is that aegis must refuse a WELL-FORMED demand it
  // cannot honour, which is a stronger statement than refusing a broken one.
  const declared = protectedHeader.crit;
  const crit = Array.isArray(declared)
    ? Object.fromEntries(declared.map((member) => [String(member), true]))
    : undefined;

  const header: Dict & { alg: string } = {
    alg: kryptos.algorithm,
    kid: kryptos.id,
    ...(typ === undefined ? {} : { typ }),
    // ⚠ LAST, so a row can restate a derived parameter deliberately — the same
    // precedence the COSE producer gives its own protected entries. On this
    // wire the JOSE name IS the key, so nothing is translated; the parameter
    // travels exactly as the row spells it, including one aegis does not
    // register, which is what a third party's own extension looks like.
    ...protectedHeader,
  };

  const payload = Buffer.from(JSON.stringify(claims), "utf8");

  // ⚠ ONE SHAPE `jose` WILL NOT WRITE AT ALL: a `crit` member the header does not
  // carry, which its producer check refuses before signing
  // (`jose/dist/webapi/lib/validate_crit.js` — `Extension Header Parameter "…" is
  // missing`). That is NOT a reason to scope such a row off this wire:
  // `@auth0/cose` does not check the same shape, and aegis's read gate is
  // wire-agnostic
  // (`src/internal/utils/validate-crit.ts#export const validateCrit` refuses the
  // member on either encoding). RFC 9052 §3.1. A row asking for the shape is
  // modelling a producer that does not validate either — hostile or merely
  // buggy — so it is signed by hand instead. ⚠ The membership test is
  // `Object.hasOwn`, never `in`: the members come off the row and `header` is a
  // plain object, so `in` would find `crit: ["toString"]` on `Object.prototype`
  // and route a row that needs this path back to `jose`.
  if (
    isArray(declared) &&
    declared.some((member) => !Object.hasOwn(header, String(member)))
  ) {
    return signCompactByHand(header, payload, kryptos, key);
  }

  return new CompactSign(payload)
    .setProtectedHeader(header)
    .sign(key, crit === undefined ? undefined : { crit });
};

/**
 * The COSE `typ` header label — 16, which postdates `@auth0/cose`'s `Headers`
 * enum, hence the numeric literal and the one cast below. Stated here rather
 * than inline so the number is not a mystery. RFC 9596 §2, RFC 9596 §4.1.
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
    // ES512 → COSE algorithm -36. RFC 9053 §2.1.
    case "ES512":
      return Algorithms.ES512;
    // HS256 → COSE algorithm 5, HMAC 256/256. RFC 9053 §3.1.
    case "HS256":
      return MacAlgorithms.HS256;
    default:
      throw new Error(
        `the foreign COSE producer has no algorithm mapping for "${kryptos.algorithm}" — add one`,
      );
  }
};

/**
 * The row's extra COSE header entries, translated to the labels the parameters
 * are keyed under.
 *
 * ⚠ A REGISTERED parameter goes through `coseByJose`, i.e. through AEGIS'S OWN
 * registry, and that is deliberate: the point of placing a parameter is to put
 * it exactly where aegis WOULD read it from. A hand-picked label the reader does
 * not look at would make every such row pass for the wrong reason — the
 * parameter would be ignored because it was invisible, not because the rule
 * under test refused it. It still THROWS for a registered parameter COSE cannot
 * carry (`x5t#S256`), which is a row asking for a label that does not exist.
 *
 * ⚠ A name the registry does not know AT ALL is written as its TEXT label
 * instead — a label in its own right (RFC 9052 §1.5), and how a third party's own
 * extension parameter actually travels. There is no integer for aegis to look up,
 * and inventing one would be the hand-picked label the paragraph above rules out.
 * This is the only way to
 * state a rule ABOUT a foreign extension, which is a capability aegis's own
 * writers cannot produce (headers are a closed set).
 */
const coseBucketEntries = (bag: Dict | undefined): Array<[CoseLabel, unknown]> =>
  Object.entries(bag ?? {}).map(([jose, value]) => [
    headerByJose(jose) === undefined ? jose : coseByJose(jose),
    value,
  ]);

const signForeignCose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  buckets: ForeignHeadersGiven | undefined,
): Promise<string> => {
  const jwk = kryptos.export("jwk") as Dict;

  const protectedEntries: Array<[CoseLabel, unknown]> = [
    [Headers.Algorithm, coseAlgorithmOf(kryptos)],
  ];

  if (typ !== undefined) protectedEntries.push([COSE_TYP_LABEL, typ]);

  protectedEntries.push(...coseBucketEntries(buckets?.protectedHeader));

  // The row's TEXT-labelled entries, appended verbatim — no registry lookup, which
  // is the whole point: they state the tstr form of a name whose integer form may
  // already be in this same bucket — both are labels (RFC 9052 §1.5).
  protectedEntries.push(
    ...Object.entries(buckets?.textLabelledProtected ?? {}).map(
      ([name, value]): [CoseLabel, unknown] => [name, value],
    ),
  );

  const protectedHeaders = new ProtectedHeaders(protectedEntries as never);
  // The row's own unprotected entries are appended AFTER the derived `kid`,
  // which is the routing hint aegis's COSE key resolution reads.
  // ⚠ `as never` on the row's own entries, for the same reason the protected
  // bucket above takes one: `@auth0/cose`'s `UnprotectedHeaders` types its value
  // union per KNOWN label, and a row here places parameters at labels it has
  // never heard of (`typ` at 16 — RFC 9596 §4.1 — and the lindorm private-use `oid`) —
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
  // COSE_Sign1 — a signature's whole property is that only the private-key holder
  // could have produced it, and a shared secret has two holders. Emitting a
  // symmetric token under the signature structure would be the confusion the two
  // structures exist to prevent, so the producer picks the structure the key
  // admits. RFC 9052 §4.2, RFC 9052 §6.2.
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
 * The signature bytes of a token NOBODY SIGNED — four zero bytes on COSE, and the
 * base64url of the same on JOSE.
 *
 * ⚠ It has to be present and it has to be the wrong length as well as the wrong
 * value: `aegis.parse` reports a payload WITHOUT checking a signature, which is
 * the reach these rows are about, so what matters is only that the token PARSES
 * as a signed structure and that nothing could have produced these bytes.
 */
const JUNK_SIGNATURE = Buffer.alloc(4);

/**
 * The identity a forged COSE envelope carries. Its VALUES are irrelevant — the
 * row's statement is about the claim the table writes — so they are spelled once
 * here rather than in every row.
 */
const FORGED_SUBJECT = "user-1";

/** An hour ahead of the row's own clock, so a verifying door reaches the claims. */
const FORGED_LIFETIME = 3600;

/**
 * The COSE key each registered claim travels under, DERIVED from the claim
 * registry — the integer label where one is registered, else the interoperable
 * text name. Hand-listing it would put a second copy of the CWT label table in
 * the harness, and a stale copy would place a forged claim where nothing reads it
 * while the row still went green on the refusal it expected for another reason.
 */
const COSE_CLAIM_KEY_BY_DOMAIN: ReadonlyMap<string, number | string> = new Map(
  CLAIM_SPECS.map((spec) => [spec.domain, coseLabel(spec) ?? coseName(spec)]),
);

/**
 * The CBOR key ONE forged member travels under. Both label forms are admitted
 * (RFC 9052 §1.5) and CBOR keys them apart — so the row's `keyedBy` cell is what
 * decides, never the shape of the text in `key`.
 */
const INTEGER_LABEL = /^-?\d+$/;

const forgedMemberKey = (member: ForgedMember): number | string => {
  if (member.keyedBy === "name") return member.key;

  // ⚠⚠ THE PATTERN, NOT `Number.isInteger(Number(key))`. `Number("")` is `0` — an
  // integer — so an EMPTY CELL resolved silently to label 0 and wrote the member
  // at a label no row named. That is not an exotic input: a blank column is
  // exactly what a Gherkin data table produces, and this is the one wrong form
  // the old guard accepted. `Number` is lenient in four further ways that all
  // reach a real label: "2.0" → 2, " 2 " → 2, "0x10" → 16, "1e3" → 1000. The
  // digits have to BE the cell. ⚠ `-?` because a label may be negative
  // (RFC 9052 §1.5), and the private-use range is entirely negative.
  if (INTEGER_LABEL.test(member.key)) return Number(member.key);

  throw new Error(
    `the row keys a forged member by the label "${member.key}", which is not an integer`,
  );
};

/**
 * The forged claim map itself.
 *
 * ⚠ A DUPLICATE RESOLVED KEY IS REFUSED. Two rows of the table that land on the
 * same CBOR key would silently collapse into one member, and a row written to
 * state that a member arrived TWICE would then state that it arrived once — and
 * still go red on the refusal it expected, for a reason that has nothing to do
 * with the capability.
 */
const forgedClaimMap = (
  carries: ReadonlyArray<ForgedMember>,
): Map<number | string, unknown> => {
  const map = new Map<number | string, unknown>();

  for (const member of carries) {
    const key = forgedMemberKey(member);

    if (map.has(key)) {
      throw new Error(
        `the row states the forged member ${JSON.stringify(key)} twice, so one of the two could never reach the wire`,
      );
    }

    map.set(key, member.value);
  }

  return map;
};

/**
 * THE FORGER — the write half of the forged-token step.
 *
 * ⭐⭐ IT EXISTS BECAUSE A CLAIMS DICT IS A CEILING. Every other producer in this
 * file takes an object and serialises it, so the shapes it can put in front of a
 * reader are exactly the shapes a JS object can hold — and a CBOR map keying one
 * member at both its integer label and its text name is not among them. This
 * function assembles the wire directly so a row can state one.
 *
 * ⛔ THE ROW STILL CARRIES NO BYTES. It states a member table; the envelope, the
 * tag chain, the algorithm identifier and the signature are written here. A row
 * holding CBOR would be asserting against a wire it had produced itself.
 */

/**
 * A forged CWT: the minimum envelope a reader needs to REACH the forged claim,
 * with the row's member table written in at the claim's own COSE key.
 *
 * ⚠ The envelope goes through aegis's own CWT codec in its INTEROPERABLE
 * spelling, the same limit `signForeignCose` carries and for the same reason —
 * the CWT label mapping (RFC 8392 §4) has no third-party implementation here to
 * borrow. Only the forged claim is hand-built, which is the half under test.
 */
const forgeCose = async (
  claim: ForgedClaim,
  carries: ReadonlyArray<ForgedMember>,
  signature: ForgedSignature,
): Promise<string> => {
  const claimKey = COSE_CLAIM_KEY_BY_DOMAIN.get(claim);

  if (claimKey === undefined) {
    throw new Error(`the row forges "${claim}", which the claim registry does not know`);
  }

  const payload = encodeCwtClaims(
    {
      iss: ISSUER,
      sub: FORGED_SUBJECT,
      exp: Math.floor(Date.now() / 1000) + FORGED_LIFETIME,
    },
    { proprietary: false },
  );

  payload.set(claimKey, forgedClaimMap(carries));

  const bytes = Buffer.from(encodeCbor(payload));

  if (signature === "junk") {
    // A COSE_Sign1 nobody signed, inside the CWT tag — assembled from raw CBOR,
    // so nothing about the structure comes from the code under test.
    return Buffer.from(
      encodeCbor(
        new Tag(
          COSE_TAG.cwt,
          new Tag(COSE_TAG.sign1, [
            encodeCbor(
              new Map<number, unknown>([
                [Headers.Algorithm, coseAlgorithmOf(KEY_FIXTURES["ec-sig"])],
              ]),
            ),
            new Map<number, unknown>(),
            bytes,
            JUNK_SIGNATURE,
          ]),
        ),
      ),
    ).toString("base64url");
  }

  const kryptos = KEY_FIXTURES[signature];

  if (kryptos === undefined) {
    throw new Error(`the row forges a token signed by the unknown key "${signature}"`);
  }

  // A COSE_Sign1 carries a DIGITAL SIGNATURE (RFC 9052 §4.2), so a shared secret
  // has no place in it — the foreign producer emits a COSE_Mac0 for one.
  // A forged row asking for a signed token is asking for the signature structure.
  if (kryptos.type === "oct") {
    throw new Error(
      `the row forges a signed CWT with the symmetric key "${signature}", which authenticates a COSE_Mac0 rather than signing a COSE_Sign1`,
    );
  }

  const { kty, crv, x, y, d } = kryptos.export("jwk") as Dict;

  const sign1 = await Sign1.sign(
    new ProtectedHeaders([[Headers.Algorithm, coseAlgorithmOf(kryptos)]] as never),
    new UnprotectedHeaders([[Headers.KeyID, Buffer.from(kryptos.id, "utf8")]]),
    bytes,
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

  // `ath` commits to the access token the proof is presented with, as the
  // base64url SHA-256 of its ASCII form. RFC 9449 §4.2.
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
      return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
    }

    case "domain-sign": {
      const signed = await ctx.aegis.sign({
        ...artifact.options,
        format: AGNOSTIC_FORMATS.sign[wire],
        payload: { ...artifact.claims, ...artifact.unregisteredClaims },
      });

      return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
    }

    case "kit-sign": {
      switch (artifact.kit) {
        case "structured": {
          const claims =
            wire === "cose" ? respellForCose(artifact.claims) : artifact.claims;
          const signed =
            AGNOSTIC_KITS.structured[wire] === "cwt"
              ? await ctx.aegis.cwt.sign(claims, {
                  ...artifact.options,
                  custom: coseCustomOf(artifact.options?.custom),
                })
              : await ctx.aegis.jwt.sign(claims, joseOptionsOf(artifact.options));
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        case "opaque": {
          const signed =
            AGNOSTIC_KITS.opaque[wire] === "cws"
              ? await ctx.aegis.cws.sign(artifact.claims, {
                  ...artifact.options,
                  custom: coseCustomOf(artifact.options?.custom),
                })
              : await ctx.aegis.jws.sign(
                  artifact.claims,
                  joseOptionsOf(artifact.options),
                );
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        case "jwt": {
          const signed = await ctx.aegis.jwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        case "cwt": {
          const signed = await ctx.aegis.cwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        case "jws": {
          const signed = await ctx.aegis.jws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        case "cws": {
          const signed = await ctx.aegis.cws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format, wrapper: signed.wrapper };
        }
        default: {
          const exhaustive: never = artifact;
          throw new Error(`unhandled kit-sign artifact ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    case "kit-encrypt": {
      switch (artifact.kit) {
        case "sealed": {
          const encrypted =
            AGNOSTIC_KITS.sealed[wire] === "cwe"
              ? await ctx.aegis.cwe.encrypt(artifact.data, {
                  ...artifact.options,
                  custom: coseCustomOf(artifact.options?.custom),
                })
              : await ctx.aegis.jwe.encrypt(
                  artifact.data,
                  joseOptionsOf(artifact.options),
                );
          return { token: encrypted.token, format: encrypted.format };
        }
        case "jwe": {
          const encrypted = await ctx.aegis.jwe.encrypt(artifact.data, artifact.options);
          return { token: encrypted.token, format: encrypted.format };
        }
        case "cwe": {
          const encrypted = await ctx.aegis.cwe.encrypt(artifact.data, artifact.options);
          return { token: encrypted.token, format: encrypted.format };
        }
        default: {
          const exhaustive: never = artifact;
          throw new Error(`unhandled kit-encrypt artifact ${JSON.stringify(exhaustive)}`);
        }
      }
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
            ? await signForeignCose(claims, typ, kryptos, artifact.buckets)
            : await signForeignJose(claims, typ, kryptos, artifact.buckets),
        // The producer emits a claims token on either wire; `format` is what the
        // READ side reports, and a foreign token is read exactly as an aegis one.
        // A shared secret makes the COSE structure a COSE_Mac0, which reads back
        // as `cwm` rather than `cwt`.
        format: wire === "cose" ? (kryptos.type === "oct" ? "cwm" : "cwt") : "jwt",
      };
    }

    case "forged": {
      // `artifactWireOf` reports this step's `wire`, so `wiresOf` has already
      // restricted the run to `"cose"` before this is reached.
      return {
        token: await forgeCose(artifact.claim, artifact.carries, artifact.signature),
        format: "cwt",
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
 * both wires: an unrecognised JOSE Header Parameter not listed in `crit` is
 * ignored (RFC 7515 §4), and an unregistered COSE label has no JOSE wire name so
 * it lands in the read result's `custom` bag rather than in a typed one
 * (`src/internal/header/cose-wire-header.ts#custom[String(label)] = value;`).
 * ⚠ That bag is NOT inert to everything: `rejectUnknownCritical` merges it into
 * the header it validates, so an added member can SATISFY a `crit` that names it
 * (`src/internal/utils/validate-crit.ts#is not present in the header`) — standing
 * in a `crit` then still needs the caller's declaration. It is inert to this
 * tamper because the tokens here carry no `crit` for the added member to be
 * named in.
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
      // The label is a tstr, admitted alongside the integer labels the bucket
      // already carries (RFC 9052 §1.5). The map is typed
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
      // `ath` commits to the access token the proof is presented with
      // (RFC 9449 §4.2), so a conformant proof does not exist until the token does and no
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
        wrapper: verified.wrapper,
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

      // An OPAQUE door takes `VerifyUnstructuredTokenOptions`, which is the
      // structured bag MINUS the claims knobs — there are no claims to bound. A
      // row stating one here would be asserting against an option the door does
      // not have, so name the mistake rather than forward a bag that is silently
      // ignored. Everything else — `certBindingMode`, `crit`, `key` — the opaque
      // door does take, and is forwarded below.
      if (step.options !== undefined && (kit === "jws" || kit === "cws")) {
        const claimsKnobs = Object.keys(step.options).filter((option) =>
          Object.hasOwn(STRUCTURED_ONLY_VERIFY_OPTIONS, option),
        );

        if (claimsKnobs.length > 0) {
          throw new Error(
            `the row hands the ${kit} door the claims verify option(s) ${claimsKnobs.join(", ")}, which it does not take — an opaque token carries no claims layer to bound.`,
          );
        }
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
            wireHeader: { value: result.header as unknown as Dict },
            customHeader: { value: result.custom },
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
            wireHeader: { value: result.protectedHeader as unknown as Dict },
            customHeader: { value: result.custom },
          };
        }
        case "jws": {
          const result = await ctx.aegis.jws.verify(current.token, step.options);
          return {
            token: current.token,
            wireHeader: { value: result.header as unknown as Dict },
            customHeader: { value: result.custom },
          };
        }
        case "cws": {
          const result = await ctx.aegis.cws.verify(current.token, step.options);
          return {
            token: current.token,
            wireHeader: { value: result.protectedHeader as unknown as Dict },
            customHeader: { value: result.custom },
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
 * A per-wire FORMAT TAG on an `accepts` verdict — `format` and `wrapper` are the
 * same shape and the same rule, so they run through one function rather than two
 * copies that could drift.
 *
 * A bare tag claims the SAME value on every wire the row runs on, which is only
 * ever true of a one-wire row; on any other wire it is refused by name rather
 * than left to fail as a puzzling value mismatch.
 */
const assertAcceptedTag = (
  stated: TokenFormatTag | Partial<Record<Wire, TokenFormatTag>> | undefined | null,
  // The RESULT side is a plain string: `ScenarioResult` carries whatever the act
  // reported, and typing it to the union here would assert the thing under test.
  actual: string | undefined,
  wire: Wire,
  field: "format" | "wrapper",
): void => {
  // NOT STATED — the row says nothing about this field, so nothing is checked.
  if (isUndefined(stated)) return;

  // STATED AS ABSENT. Only `wrapper` can be, and a row that says so is asserting
  // the other half of the discriminator: that nothing encloses this token.
  if (isNull(stated)) {
    expect(
      actual,
      `the row states that NOTHING wraps this token, but the act reported ${String(actual)}`,
    ).toBeUndefined();
    return;
  }

  if (isString(stated)) {
    expect(
      actual,
      `the row states one ${field} for every wire it runs on; on the ${wire} wire that cannot hold. State it per wire: { ${wire}: "…" }`,
    ).toBe(stated);
    return;
  }

  const expected = stated[wire];

  expect(
    expected,
    `the row states a per-wire ${field} but names none for the ${wire} wire it runs on`,
  ).toBeDefined();
  expect(actual).toBe(expected);
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
      assertAcceptedTag(step.wrapper, result.wrapper, wire, "wrapper");

      assertAcceptedTag(step.format, result.format, wire, "format");
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

    case "header": {
      // The CELL, not the value — the same guard `wireHeader` and `customHeader`
      // carry. ⚠ WHAT IT CATCHES IS NARROW AND REAL: measured on this repo's
      // `@vitest/expect`, `expect(undefined).toMatchObject({})` PASSES while
      // `expect(undefined).not.toHaveProperty(x)` THROWS — so a row with a
      // non-empty `excludes` was already red, and the vacuous shape is
      // `expected: {}` with no `excludes`. No row uses it today. The guard's value
      // is that it fails BY NAME instead of by a confusing property error, and that
      // the one shape which would pass silently cannot appear later.
      if (result.header === undefined) {
        throw new Error(
          "the row asserts on the DOMAIN header, but the last act reported none. " +
            "A `kit-verify` reports `wireHeader` — the wire vocabulary — so name that step instead.",
        );
      }

      expect(result.header).toMatchObject(step.expected);
      for (const field of step.excludes ?? []) {
        expect(result.header).not.toHaveProperty(field);
      }
      return;
    }

    case "wirePayload": {
      // ⚠ `payload`, not `wire`: naming it `wire` SHADOWS the `wire: Wire`
      // parameter, so every mention of the run's wire inside this branch would
      // read a `WirePayload` instead.
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

    case "wireHeader": {
      // The CELL, not the value — a DOMAIN act reports no wire header, and a row
      // asserting on one there is comparing two vocabularies.
      if (result.wireHeader === undefined) {
        throw new Error(
          "the row asserts on the WIRE header, but the last act reported none. " +
            "Only a `kit-verify` does — the domain verbs report `header`, in the domain vocabulary.",
        );
      }

      if (step.includes) expect(result.wireHeader.value).toMatchObject(step.includes);
      for (const key of step.excludes ?? []) {
        expect(result.wireHeader.value).not.toHaveProperty(key);
      }
      return;
    }

    case "customHeader": {
      // The CELL, not the value — see `ScenarioResult.customHeader`. A domain
      // verb reports no custom bag at all, and a row asserting on one there is
      // asserting the tier boundary does not exist.
      if (result.customHeader === undefined) {
        throw new Error(
          "the row asserts on the wire-tier `custom` header bag, but the last act reported none. " +
            "Only a `kit-verify` does — the DOMAIN verbs carry no unregistered parameter.",
        );
      }

      // ⚠ THE CELL IS GUARDED AND SO IS THE VALUE — an `excludes`-only row over
      // `{}` can never fail, so a kit that stopped reporting `custom` altogether
      // would leave such a row green. The sibling `wirePayload` branch above
      // throws for the same shape; this matches it.
      const bags = result.customHeader.value;

      if (bags === undefined) {
        throw new Error(
          "the row asserts on the wire-tier `custom` header bag, but the act reported the cell with NO value — " +
            "an exclusion over an absent bag can never fail, so the row would pass without looking.",
        );
      }

      const bag = customBucketOf(bags, step.bucket);

      if (step.includes) expect(bag).toMatchObject(step.includes);
      for (const key of step.excludes ?? []) {
        expect(bag).not.toHaveProperty(key);
      }
      return;
    }

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

      // `ath` is the base64url SHA-256 of the ASCII access token. RFC 9449 §4.2.
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

    if (verdict.code) {
      expect(error).toMatchObject({ code: verdict.code });
    }
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
    // would otherwise pass on the alteration never having happened. Inside a
    // catch it would be exactly that hole.
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
