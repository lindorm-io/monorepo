import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import {
  isArray,
  isBigInt,
  isBoolean,
  isBuffer,
  isDate,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { Aegis } from "../classes/Aegis.js";
import {
  CORPUS_CASES,
  CORPUS_CLOCK,
  CORPUS_ISSUER,
  type CorpusCase,
  type CorpusEncKey,
  type CorpusSignKey,
  type EncryptCase,
  type MintCase,
  type PayloadCell,
  type SignCase,
} from "./corpus.js";
import { inspectToken, type TokenInspection } from "./inspect-token.js";
import {
  TEST_AKP_KEY_SIG,
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

/**
 * The CORPUS RUNNER — the whole code half of the wire corpus, so `corpus.ts`
 * stays a table.
 *
 * It asks the PUBLIC `Aegis` surface for every declared token, reads each one
 * back with the INDEPENDENT wire inspector (`inspect-token.ts` — raw `cbor2` and
 * base64url, nothing from `src/internal/`), normalises the parts that cannot be
 * reproduced, and renders the whole thing as canonical JSON.
 *
 * ⚠ THE NORMALISATION RULES BELOW ARE HAND-DECLARED AND MUST STAY THAT WAY.
 * Every one of them could be derived from the header registry, which already
 * classifies `epk`/`iv`/`tag`/`p2s` as computed-by-the-crypto-operation — and
 * deriving them is exactly the wrong move: the corpus is the yardstick a
 * restructuring of that very code is measured against, and a yardstick that
 * reads its own units off the thing it measures cannot report a change in them.
 * `corpus.test.ts` binds each declared rule to reality instead, by requiring the
 * field to actually differ between two independently produced tokens.
 */

// ---------------------------------------------------------------------------
// The randomness declarations
// ---------------------------------------------------------------------------

/**
 * Signature algorithms whose output is drawn fresh on every call over the same
 * message, by algorithm family:
 *
 * - `ES*` — ECDSA (RFC 6979 notwithstanding, Node draws a fresh per-signature
 *   nonce `k`, so two signatures over one message never agree).
 * - `PS*` — RSASSA-PSS, whose EMSA-PSS encoding takes a random salt
 *   (RFC 8017 §9.1).
 * - `ML-DSA-*` — FIPS 204 §5.2 hedged signing mixes fresh randomness `rnd` into
 *   the commitment; hedged is the default variant.
 *
 * Everything else aegis can sign with is DETERMINISTIC and is therefore captured
 * byte-for-byte: `RS*` (EMSA-PKCS1-v1_5 has no randomness, RFC 8017 §9.2),
 * `EdDSA` (the nonce is derived from the key and the message, RFC 8032 §5.1.6),
 * and `HS*` (HMAC is a keyed hash).
 */
const RANDOMISED_SIGNATURE_PREFIXES: ReadonlyArray<string> = ["ES", "PS", "ML-DSA"];

/**
 * The JOSE protected-header parameters a key-management operation COMPUTES, and
 * which therefore carry fresh bytes on every encryption:
 *
 * - `epk` — the ephemeral public key of an ECDH-ES agreement (RFC 7518 §4.6.1.1).
 *   Only its COORDINATES move; `kty`/`crv` describe the curve and are kept.
 * - `iv` and `tag` — the nonce and authentication tag of an AES-GCM key wrap
 *   (RFC 7518 §4.7.1).
 * - `p2s` — the PBES2 salt input (RFC 7518 §4.8.1.1).
 *
 * ⚠ `p2c` is deliberately ABSENT: it is an iteration COUNT, which is configured
 * rather than drawn, and normalising it would blind the corpus to a change in
 * the package's PBKDF2 work factor.
 */
const RANDOM_JOSE_HEADER_PARAMS: ReadonlyArray<string> = ["epk", "iv", "p2s", "tag"];

/** The `epk` members that are key material rather than curve description. */
const RANDOM_JWK_MEMBERS: ReadonlyArray<string> = ["x", "y"];

/**
 * The COSE header labels that carry a fresh nonce. RFC 9052 §3.1 Table 2 assigns
 * label 5 to `IV`, and `CweKit` writes it into the UNPROTECTED bucket of every
 * COSE_Encrypt0 it emits (RFC 9052 §5.2 — direct encryption has no other
 * key-management output to place).
 *
 * Label 6 (Partial IV) is not listed because aegis never emits one; a rule for a
 * parameter that never appears would normalise nothing and prove nothing.
 */
const RANDOM_COSE_LABELS: ReadonlyArray<number> = [5];

/**
 * The five JOSE compact segments of a JWE (RFC 7516 §7.1) that carry fresh bytes:
 * the wrapped CEK, the content nonce, the ciphertext, and the authentication tag.
 * The protected header (index 0) is NOT among them — it is normalised parameter
 * by parameter above, so a header change still shows.
 *
 * Index 1 is EMPTY for a direct key agreement or a direct key (`dir`/`ECDH-ES`),
 * and an empty segment is kept verbatim: its absence is a fact about the key
 * management, and replacing it would hide a key management that started wrapping.
 */
const RANDOM_JWE_SEGMENTS: ReadonlyArray<number> = [1, 2, 3, 4];

/**
 * The protected-header segment (index 0).
 *
 * It is NOT in {@link RANDOM_JWE_SEGMENTS} because it is only sometimes random:
 * the segment is the base64url of the header JSON, so it moves if and only if
 * the header carries one of {@link RANDOM_JOSE_HEADER_PARAMS} — an `epk` for a
 * key agreement, a `p2s` for PBES2. A `dir` or RSA-OAEP header carries none, and
 * its segment is captured byte for byte.
 *
 * When the segment IS normalised, nothing is lost that the corpus was not
 * already recording: the same header is reported parameter by parameter under
 * `protectedHeader`, where only the moving members are replaced.
 */
const JWE_HEADER_SEGMENT = 0;

/** The compact JWS signature segment (RFC 7515 §7.1). */
const JWS_SIGNATURE_SEGMENT = 2;

const hasRandomisedSignature = (algorithm: string): boolean =>
  RANDOMISED_SIGNATURE_PREFIXES.some((prefix) => algorithm.startsWith(prefix));

// ---------------------------------------------------------------------------
// The key fixtures, by the name a row may state
// ---------------------------------------------------------------------------

const SIGN_KEYS: Record<CorpusSignKey, IKryptos> = {
  "ec-sig": TEST_EC_KEY_SIG,
  "ec-sig-cert": TEST_EC_KEY_SIG_CERT,
  "oct-sig": TEST_OCT_KEY_SIG,
  "okp-sig": TEST_OKP_KEY_SIG,
  "rsa-sig": TEST_RSA_KEY_SIG,
  "akp-sig": TEST_AKP_KEY_SIG,
};

const ENC_KEYS: Record<CorpusEncKey, IKryptos> = {
  "ec-enc": TEST_EC_KEY_ENC,
  "ec-enc-cert": TEST_EC_KEY_ENC_CERT,
  "oct-enc": TEST_OCT_KEY_ENC,
  "oct-enc-cbc": TEST_OCT_KEY_ENC_CBC,
  "oct-enc-gcm128": TEST_OCT_KEY_ENC_GCM128,
  "okp-enc": TEST_OKP_KEY_ENC,
  "rsa-enc": TEST_RSA_KEY_ENC,
};

// ---------------------------------------------------------------------------
// The deployment
// ---------------------------------------------------------------------------

export type CorpusContext = {
  aegis: Aegis;
  amphora: IAmphora;
  logger: ILogger;
};

/**
 * One deployment for the whole corpus: an Amphora scoped to the corpus issuer
 * holding every key fixture, and an `Aegis` with no settings of its own.
 *
 * Every row still injects its key OUTRIGHT (`key: { kryptos }`) rather than
 * selecting it out of the vault. A corpus row must produce the same token on a
 * machine where the vault happens to answer a query differently, and the key a
 * row means is the one thing it cannot afford to leave to a selector.
 */
export const createCorpusContext = async (): Promise<CorpusContext> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: CORPUS_ISSUER }, logger });
  const aegis = new Aegis({ amphora, logger });

  await amphora.setup();

  for (const kryptos of Object.values(SIGN_KEYS)) amphora.add(kryptos);
  for (const kryptos of Object.values(ENC_KEYS)) amphora.add(kryptos);

  return { aegis, amphora, logger };
};

// ---------------------------------------------------------------------------
// The acts
// ---------------------------------------------------------------------------

const payloadOf = (cell: PayloadCell): Buffer | string | Dict => {
  switch (cell.kind) {
    case "object":
      return cell.value;

    case "string":
      return cell.value;

    case "bytes":
      return Buffer.from(cell.hex, "hex");

    default: {
      const exhaustive: never = cell;
      throw new Error(`unhandled payload cell ${JSON.stringify(exhaustive)}`);
    }
  }
};

/** What a single act produced, before anything is read off it. */
type ActResult = {
  format: string;
  token: string;
  /** The domain sugar the verb reports, minus the token itself. */
  result: Dict;
  /** The key the signature/MAC was made with, when the act made one. */
  signAlgorithm: string | undefined;
  /** Whether the emitted outer structure is an encrypted one. */
  encrypted: boolean;
};

const runMintCase = async (kase: MintCase, ctx: CorpusContext): Promise<ActResult> => {
  const kryptos = SIGN_KEYS[kase.signKey];
  const encKryptos =
    kase.encryptKey === undefined ? undefined : ENC_KEYS[kase.encryptKey];

  // The ONE cast, and the same one `run-scenario.ts` makes: `mint<P>` resolves
  // the content type from the profile NAME, and a table holds the whole union of
  // names, which TypeScript cannot correlate with a per-row content literal.
  const signed = await ctx.aegis.mint(
    kase.profile,
    kase.content as never,
    {
      format: kase.format,
      context: kase.options.context,
      lifetime: kase.options.lifetime,
      proprietary: kase.options.proprietary,
      sign: {
        key: { kryptos },
        tokenId: kase.options.tokenId,
        accessTokenHash: kase.options.accessTokenHash,
        codeHash: kase.options.codeHash,
        stateHash: kase.options.stateHash,
        typ: kase.options.typ,
        header: kase.options.header,
        bindCertificate: kase.options.bindCertificate,
        certificateThumbprintSha1: kase.options.certificateThumbprintSha1,
      },
      ...(encKryptos === undefined ? {} : { encrypt: { key: { kryptos: encKryptos } } }),
    } as never,
  );

  return {
    format: signed.format,
    token: signed.token,
    result: {
      expiresAt: signed.expiresAt,
      expiresIn: signed.expiresIn,
      expiresOn: signed.expiresOn,
      format: signed.format,
      objectId: signed.objectId,
      tokenId: signed.tokenId,
    },
    signAlgorithm: kryptos.algorithm,
    encrypted: encKryptos !== undefined,
  };
};

const runSignCase = async (kase: SignCase, ctx: CorpusContext): Promise<ActResult> => {
  const kryptos = SIGN_KEYS[kase.signKey];

  const signed = await ctx.aegis.sign({
    format: kase.format,
    payload: payloadOf(kase.payload),
    key: { kryptos },
    tokenType: kase.options?.tokenType,
    header: kase.options?.header,
    bindCertificate: kase.options?.bindCertificate,
    certificateThumbprintSha1: kase.options?.certificateThumbprintSha1,
  });

  return {
    format: signed.format,
    token: signed.token,
    result: {
      expiresAt: signed.expiresAt,
      expiresIn: signed.expiresIn,
      expiresOn: signed.expiresOn,
      format: signed.format,
      objectId: signed.objectId,
      tokenId: signed.tokenId,
    },
    signAlgorithm: kryptos.algorithm,
    encrypted: false,
  };
};

const runEncryptCase = async (
  kase: EncryptCase,
  ctx: CorpusContext,
): Promise<ActResult> => {
  const kryptos = ENC_KEYS[kase.encryptKey];

  const encrypted = await ctx.aegis.encrypt(payloadOf(kase.data) as never, {
    format: kase.format,
    key: { kryptos },
    type: kase.options?.type,
    header: kase.options?.header,
    partyProducer: kase.options?.partyProducer,
    partyRecipient: kase.options?.partyRecipient,
    proprietary: kase.options?.proprietary,
    bindCertificate: kase.options?.bindCertificate,
  });

  return {
    format: encrypted.format,
    token: encrypted.token,
    result: { format: encrypted.format },
    signAlgorithm: undefined,
    encrypted: true,
  };
};

const runCase = (kase: CorpusCase, ctx: CorpusContext): Promise<ActResult> => {
  switch (kase.verb) {
    case "mint":
      return runMintCase(kase, ctx);

    case "sign":
      return runSignCase(kase, ctx);

    case "encrypt":
      return runEncryptCase(kase, ctx);

    default: {
      const exhaustive: never = kase;
      throw new Error(`unhandled corpus case ${JSON.stringify(exhaustive)}`);
    }
  }
};

// ---------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------

/** One corpus row's answer, RAW — nothing normalised, nothing hidden. */
export type RawCorpusEntry = {
  name: string;
  note: string;
  verb: string;
  profile: string | undefined;
  requestedFormat: string;
  reportedFormat: string;
  wire: string;
  /**
   * The algorithm the row's signing key declares, `undefined` for a row that
   * signs nothing. It decides two things a reader otherwise has to guess: whether
   * the signature is reproducible, and — on the COSE wire — whether the structure
   * is a COSE_Sign1 or a COSE_Mac0, since a shared secret cannot make a signature.
   */
  signAlgorithm: string | undefined;
  token: string;
  result: Dict;
  inspection: TokenInspection;
  /** What the runner knows about this row's randomness — never inspected, declared. */
  randomness: { encrypted: boolean; signature: boolean };
};

const requestedFormatOf = (kase: CorpusCase): string => kase.format;

const profileOf = (kase: CorpusCase): string | undefined =>
  kase.verb === "mint" ? kase.profile : undefined;

export const runRawCase = async (
  kase: CorpusCase,
  ctx: CorpusContext,
): Promise<RawCorpusEntry> => {
  const act = await runCase(kase, ctx);

  if (act.token.length === 0) {
    throw new Error(`the corpus row "${kase.name}" produced an empty token`);
  }

  const inspection = inspectToken(act.token);

  return {
    name: kase.name,
    note: kase.note,
    verb: kase.verb,
    profile: profileOf(kase),
    requestedFormat: requestedFormatOf(kase),
    reportedFormat: act.format,
    wire: inspection.wire,
    signAlgorithm: act.signAlgorithm,
    token: act.token,
    result: act.result,
    inspection,
    randomness: {
      encrypted: act.encrypted,
      signature:
        act.signAlgorithm !== undefined && hasRandomisedSignature(act.signAlgorithm),
    },
  };
};

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const randomBytes = (byteLength: number): string => `<random:${byteLength} bytes>`;

const randomChars = (charLength: number): string => `<random:${charLength} chars>`;

const segmentBytes = (segment: string): number =>
  Buffer.from(segment, "base64url").length;

/**
 * Replace a base64url segment with a placeholder that records its DECODED length.
 * An empty segment is kept verbatim — see {@link RANDOM_JWE_SEGMENTS}.
 */
const normaliseSegment = (segment: string): string =>
  segment.length === 0 ? segment : randomBytes(segmentBytes(segment));

const normaliseJwk = (value: unknown): unknown => {
  if (!isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value as Dict).map(([member, entry]) => [
      member,
      RANDOM_JWK_MEMBERS.includes(member) && isString(entry)
        ? randomBytes(segmentBytes(entry))
        : entry,
    ]),
  );
};

const normaliseJoseHeader = (header: Dict, encrypted: boolean): Dict => {
  if (!encrypted) return header;

  return Object.fromEntries(
    Object.entries(header).map(([param, value]) => {
      if (!RANDOM_JOSE_HEADER_PARAMS.includes(param)) return [param, value];
      if (param === "epk") return [param, normaliseJwk(value)];

      return [param, isString(value) ? randomBytes(segmentBytes(value)) : value];
    }),
  );
};

const normaliseJoseParts = (
  parts: ReadonlyArray<string>,
  randomness: { encrypted: boolean; signature: boolean },
  headerMoves: boolean,
): ReadonlyArray<string> => {
  if (parts.length === 5) {
    return parts.map((part, index) =>
      RANDOM_JWE_SEGMENTS.includes(index) || (index === JWE_HEADER_SEGMENT && headerMoves)
        ? normaliseSegment(part)
        : part,
    );
  }

  if (parts.length === 3 && randomness.signature) {
    return parts.map((part, index) =>
      index === JWS_SIGNATURE_SEGMENT ? normaliseSegment(part) : part,
    );
  }

  return parts;
};

const normaliseCoseLabels = (
  header: ReadonlyMap<number | string, unknown>,
  encrypted: boolean,
): ReadonlyMap<number | string, unknown> => {
  if (!encrypted) return header;

  const normalised = new Map<number | string, unknown>();

  for (const [label, value] of header) {
    normalised.set(
      label,
      isNumber(label) && RANDOM_COSE_LABELS.includes(label) && value instanceof Uint8Array
        ? randomBytes(value.length)
        : value,
    );
  }

  return normalised;
};

const normaliseInspection = (entry: RawCorpusEntry): Dict => {
  const { inspection, randomness } = entry;

  if (inspection.wire === "jose") {
    const headerMoves =
      randomness.encrypted &&
      Object.keys(inspection.protectedHeader).some((param) =>
        RANDOM_JOSE_HEADER_PARAMS.includes(param),
      );

    return {
      wire: inspection.wire,
      partCount: inspection.partCount,
      parts: normaliseJoseParts(inspection.parts, randomness, headerMoves),
      protectedHeader: normaliseJoseHeader(
        inspection.protectedHeader,
        randomness.encrypted,
      ),
      unprotectedHeader: inspection.unprotectedHeader,
      payload: inspection.payload,
    };
  }

  return {
    wire: inspection.wire,
    tags: inspection.tags,
    protectedHeader: inspection.protectedHeader,
    unprotectedHeader: normaliseCoseLabels(
      inspection.unprotectedHeader,
      randomness.encrypted,
    ),
    payload: inspection.payload,
  };
};

/**
 * The token itself, verbatim when the row can reproduce it byte for byte.
 *
 * ⚠ A COSE structure's signature/MAC/ciphertext is the fourth element of the
 * structure array, and the independent inspector does not report it — so for a
 * COSE row with a randomised signature the placeholder's CHARACTER LENGTH is the
 * only record of it. A row signed by a deterministic algorithm has its whole
 * token captured, signature included, which is why the table carries an EdDSA,
 * an RS512 and an HS256 row on the COSE wire.
 */
const normaliseToken = (entry: RawCorpusEntry): string =>
  entry.randomness.encrypted || entry.randomness.signature
    ? randomChars(entry.token.length)
    : entry.token;

export const normaliseEntry = (entry: RawCorpusEntry): Dict => ({
  name: entry.name,
  note: entry.note,
  verb: entry.verb,
  profile: entry.profile,
  requestedFormat: entry.requestedFormat,
  reportedFormat: entry.reportedFormat,
  wire: entry.wire,
  signAlgorithm: entry.signAlgorithm,
  randomness: entry.randomness,
  token: normaliseToken(entry),
  result: entry.result,
  inspection: normaliseInspection(entry),
});

// ---------------------------------------------------------------------------
// Canonical encoding
// ---------------------------------------------------------------------------

/**
 * The canonical, stable-ordered tree a corpus is rendered from.
 *
 * Every value that JSON cannot state faithfully is TAGGED rather than coerced:
 *
 * - `undefined` becomes `{ $undefined: true }`, so a stated-but-absent member
 *   (`JoseInspection.unprotectedHeader` is always one) is distinguishable from a
 *   member that is not there at all — `JSON.stringify` drops both otherwise.
 * - Bytes become `{ $bytes: <hex>, $length: n }`. A COSE `kid` is a byte string,
 *   and hex is the only rendering that shows a length change as a length change.
 * - A `Map` becomes `{ $map: [[key, value], …] }` with its keys SORTED, and each
 *   key is tagged `{ $int }` or `{ $text }`. RFC 9052 §1.5 defines a COSE label
 *   as `int / tstr`, so the integer `4` and the text `"4"` are different labels;
 *   a plain object could represent neither faithfully and would silently merge
 *   the two.
 * - A `Date` becomes `{ $date: <ISO> }`.
 *
 * Plain-object keys are sorted lexicographically. (An integer-like key would be
 * re-hoisted by the engine's own property order; no header parameter or claim
 * name in this corpus is one, and the result is deterministic either way, which
 * is what the rendering needs.)
 */
export const canonicalTree = (value: unknown): unknown => {
  if (isUndefined(value)) return { $undefined: true };
  if (value === null) return null;
  if (isString(value) || isBoolean(value)) return value;
  if (isNumber(value)) return value;
  if (isBigInt(value)) return { $bigint: value.toString() };
  if (isDate(value)) return { $date: value.toISOString() };

  if (isBuffer(value) || value instanceof Uint8Array) {
    return { $bytes: Buffer.from(value).toString("hex"), $length: value.length };
  }

  if (isArray(value)) return value.map(canonicalTree);

  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(
      ([key, entry]) => [canonicalMapKey(key), canonicalTree(entry)] as const,
    );

    entries.sort((left, right) => compareMapKeys(left[0], right[0]));

    return { $map: entries.map(([key, entry]) => [key, entry]) };
  }

  if (isObject(value)) {
    const keys = Object.keys(value as Dict).sort();

    return Object.fromEntries(
      keys.map((key) => [key, canonicalTree((value as Dict)[key])]),
    );
  }

  throw new Error(
    `the corpus produced a value canonical rendering cannot state: ${Object.prototype.toString.call(value)}`,
  );
};

type CanonicalMapKey = { $int: number } | { $text: string };

const canonicalMapKey = (key: unknown): CanonicalMapKey => {
  if (isNumber(key)) return { $int: key };
  if (isString(key)) return { $text: key };

  throw new Error(
    `a COSE label is an int or a tstr (RFC 9052 §1.5), and this map is keyed by ${Object.prototype.toString.call(key)}`,
  );
};

/** Integer labels first, ascending; then text labels, lexicographic. */
const compareMapKeys = (left: CanonicalMapKey, right: CanonicalMapKey): number => {
  if ("$int" in left && "$int" in right) return left.$int - right.$int;
  if ("$int" in left) return -1;
  if ("$int" in right) return 1;

  return (left as { $text: string }).$text < (right as { $text: string }).$text ? -1 : 1;
};

export const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalTree(value), null, 2);

// ---------------------------------------------------------------------------
// Path walking — the evidence half
// ---------------------------------------------------------------------------

const joinPath = (path: string, step: string): string =>
  path.length === 0 ? step : `${path}${step.startsWith("[") ? "" : "."}${step}`;

const walkLeaves = (tree: unknown, path: string, into: Map<string, string>): void => {
  if (isArray(tree)) {
    tree.forEach((entry, index) => walkLeaves(entry, joinPath(path, `[${index}]`), into));
    return;
  }

  if (isObject(tree)) {
    for (const [key, entry] of Object.entries(tree as Dict)) {
      walkLeaves(entry, joinPath(path, key), into);
    }
    return;
  }

  into.set(path, JSON.stringify(tree ?? null));
};

/** Every leaf of a canonical tree, keyed by its path. */
export const leavesOf = (tree: unknown): Map<string, string> => {
  const leaves = new Map<string, string>();

  walkLeaves(tree, "", leaves);

  return leaves;
};

/**
 * The leaf paths at which two canonical trees disagree — a leaf present on one
 * side only counts as a disagreement, because a field that sometimes appears is
 * exactly as irreproducible as one whose bytes move.
 */
export const differingPaths = (left: unknown, right: unknown): ReadonlyArray<string> => {
  const leftLeaves = leavesOf(left);
  const rightLeaves = leavesOf(right);
  const paths = new Set([...leftLeaves.keys(), ...rightLeaves.keys()]);

  return Array.from(paths)
    .filter((path) => leftLeaves.get(path) !== rightLeaves.get(path))
    .sort();
};

const PLACEHOLDER_PREFIX = "<random:";

/** Every leaf path a normalisation rule replaced with a placeholder. */
export const placeholderPaths = (tree: unknown): ReadonlyArray<string> =>
  Array.from(leavesOf(tree).entries())
    .filter(([, value]) => value.startsWith(`"${PLACEHOLDER_PREFIX}`))
    .map(([path]) => path)
    .sort();

/**
 * Whether a differing path is COVERED by a normalised one. A byte string is
 * rendered `{ $bytes, $length }`, so its leaves sit one step below the path the
 * placeholder (a plain string) occupies; a JWK sits two.
 */
export const isCoveredBy = (path: string, normalised: string): boolean =>
  path === normalised ||
  path.startsWith(`${normalised}.`) ||
  path.startsWith(`${normalised}[`);

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

export type CorpusRecord = {
  clock: string;
  issuer: string;
  caseCount: number;
  cases: ReadonlyArray<Dict>;
};

/**
 * Produce every declared row, RAW.
 *
 * The clock is pinned FIRST and for the whole pass: `iat`, `nbf` and `exp` are
 * derived from it, and a pass that let it move would produce a corpus whose rows
 * disagree with each other as well as with the next pass.
 */
export const buildRawCorpus = async (): Promise<ReadonlyArray<RawCorpusEntry>> => {
  MockDate.set(new Date(CORPUS_CLOCK));

  const ctx = await createCorpusContext();
  const entries: Array<RawCorpusEntry> = [];

  for (const kase of CORPUS_CASES) {
    entries.push(await runRawCase(kase, ctx));
  }

  return entries;
};

export const buildCorpus = async (): Promise<CorpusRecord> => {
  const raw = await buildRawCorpus();

  return {
    clock: CORPUS_CLOCK,
    issuer: CORPUS_ISSUER,
    caseCount: raw.length,
    cases: raw.map(normaliseEntry),
  };
};

export const renderCorpus = async (): Promise<string> =>
  canonicalJson(await buildCorpus());

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

/**
 * The destination: `AEGIS_CORPUS_OUT`, else the first positional argument, else
 * stdout. Stdout is the default because a corpus is a thing to pipe into a diff.
 */
const outputPath = (): string | undefined =>
  process.env.AEGIS_CORPUS_OUT ?? process.argv[2];

const isMain = (): boolean =>
  isString(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain()) {
  const json = await renderCorpus();
  const out = outputPath();

  if (isString(out)) {
    await writeFile(out, `${json}\n`, "utf8");
  } else {
    process.stdout.write(`${json}\n`);
  }
}
