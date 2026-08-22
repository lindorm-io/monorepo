import type { Dict } from "@lindorm/types";
import { decode, Tag } from "cbor2";

/**
 * The RAW WIRE INSPECTOR — an INDEPENDENT reader of what a token actually says.
 *
 * ⛔ IT IMPORTS NOTHING FROM `src/internal/` OR `src/classes/`, AND MUST NOT.
 * Not `unwrapCose`, not the header registry, not `coseByJose`, not the claim
 * translator. Only `Buffer`/`JSON` for JOSE and the `cbor2` package for COSE.
 *
 * That prohibition IS the tool. Every other wire assertion in this package runs
 * the token back through aegis's own decoder, which proves the package is
 * SELF-CONSISTENT and nothing more: a mint bug and a read bug that mirror each
 * other round-trip perfectly. This package has already produced a wire-format
 * defect of exactly that shape — `crit` members written as JOSE text NAMES while
 * the parameters they named were keyed by INTEGER label — fatal to a conformant
 * reader (RFC 9052 §3.1) and fine to a round trip.
 *
 * ⚠ EVERYTHING IS REPORTED IN THE WIRE'S OWN VOCABULARY: raw COSE labels (`7`,
 * `-70000`) and raw JOSE names (`jti`, `oid`) — never the domain names aegis
 * translates them to (`tokenId`, `objectId`). A report in domain vocabulary would
 * be a report of our interpretation, which is the thing under test.
 *
 * Nothing here is a policy check. The inspector says what the bytes are; whether
 * that is correct is the caller's assertion to make.
 */

/**
 * A COSE map key — an int or a tstr (RFC 9052 §1.5), so the integer `4` and the
 * text string `"4"` are DIFFERENT labels and are reported apart.
 */
export type CoseLabel = number | string;

/** A COSE map exactly as the CBOR decoder produced it: raw labels, raw values. */
export type RawLabelMap = ReadonlyMap<CoseLabel, unknown>;

/**
 * A part of the wire that may not be there to read.
 *
 * UNREADABILITY IS STATED, never flattened to an empty container: a JWE's and a
 * COSE_Encrypt0's payload are ciphertext, and every exclusion assertion over an
 * empty container passes without checking anything. A caller that wants to assert
 * on a payload must therefore handle `readable: false` explicitly, and the only
 * honest handling is to fail.
 */
export type WirePart<T> =
  | { readable: true; value: T }
  | { readable: false; reason: string };

/** The CBOR tags this inspector names (RFC 9052 §2 Table 1; the CWT tag, RFC 8392 §9.4). */
export const CBOR_TAG = {
  encrypt0: 16,
  mac0: 17,
  sign1: 18,
  cwt: 61,
} as const;

export type JoseInspection = {
  wire: "jose";
  /** The compact serialisation's parts, verbatim and undecoded. */
  parts: ReadonlyArray<string>;
  /** 3 for a JWS/JWT, 5 for a JWE. Anything else is not a compact JOSE token. */
  partCount: number;
  /** The decoded protected header object, JOSE-NAME-keyed (`alg`, `typ`, `kid`). */
  protectedHeader: Dict;
  /**
   * ALWAYS `undefined`, and stated rather than omitted: a JOSE compact token has
   * no unprotected bucket (RFC 7515 §7.1), so an empty object here would be a
   * fabrication — and a truthy one.
   */
  unprotectedHeader: undefined;
  /** The decoded payload object, JOSE-NAME-keyed — or why it cannot be read. */
  payload: WirePart<Dict>;
};

export type CoseInspection = {
  wire: "cose";
  /**
   * The CBOR tag chain, OUTERMOST FIRST — `[61, 18]` for a tagged CWT carrying a
   * COSE_Sign1, `[61, 16]` for a CWE. Empty for a bare untagged structure.
   */
  tags: ReadonlyArray<number>;
  /** The protected bucket as a raw label map. Empty when the wire carried `h''`. */
  protectedHeader: RawLabelMap;
  /** The unprotected bucket as a raw label map. Always present on a COSE structure. */
  unprotectedHeader: RawLabelMap;
  /** The payload as a raw label map — or why it cannot be read as one. */
  payload: WirePart<RawLabelMap>;
};

export type TokenInspection = JoseInspection | CoseInspection;

/** The inspector's own diagnostic. It is never an aegis error — see the file docstring. */
export class WireInspectionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WireInspectionError";
  }
}

const decodeCbor = (bytes: Uint8Array): unknown => {
  try {
    // `preferMap` keeps integer-keyed maps as `Map`s: a COSE label is an int or a
    // tstr (RFC 9052 §1.5) and a JS object key can represent neither faithfully.
    // `rejectDuplicateKeys` refuses the parsing ambiguity COSE's own security
    // considerations call out.
    return decode(bytes, { preferMap: true, rejectDuplicateKeys: true });
  } catch (err) {
    throw new WireInspectionError(
      `the bytes are not decodable CBOR: ${(err as Error).message}`,
    );
  }
};

const asLabelMap = (value: unknown, what: string): RawLabelMap => {
  if (!(value instanceof Map)) {
    throw new WireInspectionError(
      `the ${what} is not a CBOR map (it decoded as ${value === null ? "null" : typeof value})`,
    );
  }

  return value as RawLabelMap;
};

/**
 * The protected bucket is a BYTE STRING wrapping the encoded header map, and an
 * EMPTY protected bucket is a zero-length byte string (`h''`), not the encoding
 * of an empty map (RFC 9052 §3).
 */
const decodeProtectedBucket = (value: unknown): RawLabelMap => {
  if (!(value instanceof Uint8Array)) {
    throw new WireInspectionError(
      "the protected bucket is not a byte string, so it is not a COSE header",
    );
  }

  return value.length === 0
    ? new Map()
    : asLabelMap(decodeCbor(value), "protected header");
};

const inspectJose = (token: string): JoseInspection => {
  const parts = token.split(".");

  let protectedHeader: Dict;

  try {
    protectedHeader = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Dict;
  } catch (err) {
    throw new WireInspectionError(
      `the first part is not a base64url JSON header: ${(err as Error).message}`,
    );
  }

  return {
    wire: "jose",
    parts,
    partCount: parts.length,
    protectedHeader,
    unprotectedHeader: undefined,
    payload: joseWirePayload(parts),
  };
};

const joseWirePayload = (parts: ReadonlyArray<string>): WirePart<Dict> => {
  if (parts.length === 5) {
    return {
      readable: false,
      reason: "a 5-part JWE carries ciphertext where a JWS carries its payload",
    };
  }

  if (parts.length !== 3) {
    return {
      readable: false,
      reason: `a ${parts.length}-part token is not a compact JOSE serialisation (3 parts for a JWS, 5 for a JWE)`,
    };
  }

  try {
    return {
      readable: true,
      value: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Dict,
    };
  } catch (err) {
    // A 3-part token is not necessarily a JWT — a JWS over opaque bytes is one
    // too, and its payload is not JSON. That is a readable fact about the token,
    // not a malformed token.
    return {
      readable: false,
      reason: `the payload is not JSON — it is an opaque JWS body (${(err as Error).message})`,
    };
  }
};

const cosePayload = (
  value: unknown,
  tags: ReadonlyArray<number>,
): WirePart<RawLabelMap> => {
  if (tags.includes(CBOR_TAG.encrypt0)) {
    return {
      readable: false,
      reason:
        "a COSE_Encrypt0 carries ciphertext where a COSE_Sign1/Mac0 carries its payload",
    };
  }

  if (value === null || value === undefined) {
    return {
      readable: false,
      reason: "the payload is detached (nil), so there is nothing to read",
    };
  }

  if (!(value instanceof Uint8Array)) {
    return {
      readable: false,
      reason: `the payload is not a byte string (it is a ${typeof value})`,
    };
  }

  let decoded: unknown;

  try {
    decoded = decodeCbor(value);
  } catch (err) {
    // ONE reason for both ways of not being a claims map — bytes that do not
    // decode as CBOR at all, and CBOR that decodes to something else. An opaque
    // CWS payload is arbitrary bytes and lands in either arm depending on what
    // those bytes happen to look like, which is no reason for two verdicts.
    return {
      readable: false,
      reason: `the payload is not a CBOR map, so it carries no claims to read (${(err as Error).message})`,
    };
  }

  if (!(decoded instanceof Map)) {
    return {
      readable: false,
      reason: `the payload is not a CBOR map, so it carries no claims to read (it decoded as ${decoded === null ? "null" : typeof decoded})`,
    };
  }

  return { readable: true, value: decoded as RawLabelMap };
};

const inspectCose = (token: string): CoseInspection => {
  const bytes = Buffer.from(token, "base64url");

  if (bytes.length === 0) {
    throw new WireInspectionError("the token is empty, so there are no bytes to inspect");
  }

  let value = decodeCbor(bytes);
  const tags: Array<number> = [];

  // Unwrap the tag chain OUTERMOST FIRST, keeping every tag: the outer CWT tag
  // (61) and the structure tag (16/17/18) are separate statements about the same
  // bytes, and which structure a token is IS the thing a reader must be able to
  // see for itself.
  while (value instanceof Tag) {
    tags.push(Number(value.tag));
    value = value.contents;
  }

  if (!Array.isArray(value)) {
    throw new WireInspectionError(
      `the CBOR decodes to ${value === null ? "null" : typeof value}, not to a COSE structure array`,
    );
  }

  if (value.length < 3) {
    throw new WireInspectionError(
      `a COSE structure array has at least 3 elements, this one has ${value.length}`,
    );
  }

  const [protectedBucket, unprotected, payload] = value as ReadonlyArray<unknown>;

  return {
    wire: "cose",
    tags,
    protectedHeader: decodeProtectedBucket(protectedBucket),
    unprotectedHeader: asLabelMap(unprotected, "unprotected bucket"),
    payload: cosePayload(payload, tags),
  };
};

/**
 * Read a token as BYTES and report what is on the wire.
 *
 * The wire is decided by the token's own shape and nothing else — a JOSE compact
 * serialisation is dot-separated, a COSE object is base64url CBOR — so the
 * inspector never has to be TOLD what it is looking at, which is one more thing
 * it cannot be lied to about.
 *
 * THROWS (never reports a degenerate result) when the bytes are not a token at
 * all: the caller asked what a token says, and answering "nothing" about an
 * unparseable input is the vacuous pass this whole module exists to prevent.
 */
export const inspectToken = (token: string): TokenInspection => {
  if (token.length === 0) {
    throw new WireInspectionError("the token is empty, so there is no wire to inspect");
  }

  return token.includes(".") ? inspectJose(token) : inspectCose(token);
};
