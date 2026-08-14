import { isArray, isBoolean, isBuffer, isNumber, isObject, isString } from "@lindorm/is";
import { AegisError } from "../../errors/index.js";
import type { TokenContent } from "../../types/index.js";
import { decodeCbor } from "../cose/cbor.js";

/**
 * ⭐ ONE ENCODING FOR OPAQUE CONTENT, ON EVERY DOOR. A structured value is JSON
 * (RFC 8259) whichever wire carries it — this codec serialises OPAQUE content
 * only, and opaque content is bytes the kit was handed rather than a claims set
 * it understands, so there is nothing about the COSE wire that makes CBOR the
 * truer answer for it. A CWT's CLAIMS are a different thing entirely and take a
 * different road: `internal/cose/cwt-message.ts` maps them to RFC 8392 integer
 * labels and never reaches this file.
 *
 * ⚠ The write side once took a per-kit `structured: "cbor" | "json"` family, and
 * its docstring called that "the ONE thing that differs between the two wire
 * families … Every kit passes its own". Neither half was true: all four callers
 * passed `"json"` (`JwtKit`/`JwsKit`/`JweKit`/`CwsKit`/`CweKit`), and the CBOR arm
 * existed for a CWE claims plaintext that the pure-confidentiality encrypt/decrypt
 * pair deleted. Only the READ side keeps its `application/cbor` case, and that one
 * is reachable: a FOREIGN token may declare the media type RFC 8949 §9.1 registers.
 */

/**
 * The three media types the codec SERIALISES to — the natural wire encoding of a
 * JS value. A caller may override the wire LABEL (a token cty, a params-carrying
 * media type), but the bytes are always produced from one of these three shapes.
 * `application/json` is registered by RFC 8259 §11.
 */
type SerialisableContentType =
  | "application/json"
  | "application/octet-stream"
  | "text/plain";

/**
 * How {@link reconstructContent} turns wire bytes back into a native value. The
 * four base types plus the two TOKEN families (a nested JOSE token → its compact
 * `string`, a nested COSE token → its `Buffer`) and the `buffer` fallback for an
 * absent/unknown cty (never guess a parse the wire did not declare).
 */
type ReconstructStrategy =
  | "cbor"
  | "json"
  | "text"
  | "octet"
  | "jose-token"
  | "cose-token"
  | "buffer";

/**
 * Normalise a wire cty to its bare media type: strip any RFC 2045 parameters
 * (e.g. `text/plain; charset=utf-8` → `text/plain`) and lower-case, so an external
 * JOSE/COSE producer's parameterised cty still reconstructs faithfully.
 */
export const bareMediaType = (cty: string): string =>
  cty.split(";")[0].trim().toLowerCase();

/**
 * A NESTED JOSE token — `application/jwt`, the `JWT` short form (RFC 7519 §5.2),
 * any structured `…+jwt` media type, or `application/jose`, which RFC 7515 §9.2.1
 * registers for "a JWS or JWE using the JWS Compact Serialization or the JWE
 * Compact Serialization". Its native form is a compact `string`.
 *
 * ⚠ BOTH spellings of `application/jose` are accepted. RFC 7515 §4.1.10: "it is
 * RECOMMENDED that producers omit an 'application/' prefix of a media type value
 * in a 'cty' Header Parameter when no other '/' appears in the media type value.
 * A recipient using the media type value MUST treat it as if 'application/' were
 * prepended to any 'cty' value not containing a '/'." So a conformant foreign
 * producer may send either, and the bare form is the RECOMMENDED one — refusing
 * it would be refusing the spelling the RFC prefers.
 */
const isJoseTokenCty = (bare: string): boolean =>
  bare === "application/jwt" ||
  bare === "jwt" ||
  bare === "application/jose" ||
  bare === "jose" ||
  bare.endsWith("+jwt");

/**
 * A NESTED COSE token — `application/cwt` or any structured
 * `…+cwt`/`…+cwm`/`…+cwe`/`…+cws` media type. Its native form is the CBOR-encoded
 * `Buffer` (unlike a JOSE token, which is a compact `string`).
 */
const isCoseTokenCty = (bare: string): boolean =>
  bare === "application/cwt" ||
  bare.endsWith("+cwt") ||
  bare.endsWith("+cwm") ||
  bare.endsWith("+cwe") ||
  bare.endsWith("+cws");

/** Map the wire cty to the reconstruction strategy; absent/unknown ⇒ raw Buffer. */
const reconstructStrategy = (cty: string | undefined): ReconstructStrategy => {
  if (cty === undefined) return "buffer";

  const bare = bareMediaType(cty);

  switch (bare) {
    case "application/cbor":
      return "cbor";

    case "application/json":
      return "json";

    case "text/plain":
      return "text";

    case "application/octet-stream":
      return "octet";

    default:
      if (isJoseTokenCty(bare)) return "jose-token";
      if (isCoseTokenCty(bare)) return "cose-token";
      return "buffer";
  }
};

/** Infer the serialisable content type from the JS value shape. */
const inferContentType = (content: TokenContent): SerialisableContentType => {
  if (isString(content)) return "text/plain";
  if (isBuffer(content)) return "application/octet-stream";
  if (isArray(content) || isBoolean(content) || isNumber(content) || isObject(content)) {
    return "application/json";
  }

  throw new AegisError("Invalid content type", {
    code: "invalid_content_type",
    title: "Invalid Content Type",
    details:
      "The content is not a supported type; expected a string, Buffer, array, boolean, number, or object.",
    data: { type: typeof content },
  });
};

/** Serialise a JS value to wire bytes per its inferred serialisable content type. */
const contentToBytes = (
  content: TokenContent,
  contentType: SerialisableContentType,
): Buffer => {
  switch (contentType) {
    case "application/json":
      return Buffer.from(JSON.stringify(content), "utf8");

    case "application/octet-stream":
      return content as Buffer;

    case "text/plain":
      return Buffer.from(content as string, "utf8");

    default: {
      const exhaustive: never = contentType;
      throw new AegisError("Invalid content type", {
        code: "invalid_content_type",
        title: "Invalid Content Type",
        details:
          "The content type is not a supported value for serialisation; expected application/json, application/octet-stream, or text/plain.",
        data: { contentType: String(exhaustive) },
      });
    }
  }
};

/**
 * Serialise a token's content to wire bytes and resolve the wire cty. The bytes
 * are always produced from the JS value shape ({@link inferContentType}); the
 * returned `contentType` is the caller-supplied `cty` when given
 * (caller-cty-wins — e.g. `JWT` for a nested token) and the inferred type
 * otherwise. The bytes are OPAQUE to the AEAD/signer; the cty rides the protected
 * header so decrypt/verify reconstructs the native JS type.
 */
export const serialiseContent = (
  content: TokenContent,
  cty?: string,
): { bytes: Buffer; contentType: string } => {
  const inferred = inferContentType(content);
  return { bytes: contentToBytes(content, inferred), contentType: cty ?? inferred };
};

/**
 * Reconstruct a token's content from wire bytes + the cty read off the header. The
 * four base types round-trip to their native JS value; a TOKEN cty yields the raw
 * nested token in its native form (a `string` for a JOSE/compact token, a `Buffer`
 * for a COSE token) so the verify recursion can re-read it; an ABSENT or UNKNOWN
 * cty falls back to the raw `Buffer` (the safe default — never guess a parse the
 * wire did not declare). Tolerant of RFC 2045 media-type parameters.
 */
export const reconstructContent = <T extends TokenContent = Buffer>(
  bytes: Buffer,
  cty: string | undefined,
): T => {
  const strategy = reconstructStrategy(cty);

  switch (strategy) {
    // ⚠ A READ-ONLY case: this codec never WRITES `application/cbor` (there is
    // one encoding for opaque content, and it is JSON). It is here for a FOREIGN
    // token that declares the media type RFC 8949 §9.1 registers — without it
    // such a payload fell through to the `buffer` fallback and a caller got bytes
    // where the producer stated an object. `preferMap: false` so a string-keyed
    // CBOR map decodes to a plain object, mirroring the JSON twin.
    case "cbor":
      return decodeCbor<T>(bytes, { preferMap: false });

    case "json":
      return JSON.parse(bytes.toString("utf8")) as T;

    case "text":
    case "jose-token":
      return bytes.toString("utf8") as T;

    case "octet":
    case "cose-token":
    case "buffer":
      return bytes as T;

    default: {
      const exhaustive: never = strategy;
      throw new AegisError("Unhandled content reconstruction strategy", {
        code: "unexpected_content_type",
        title: "Unexpected Content Type",
        details:
          "The reconstruction strategy is not a supported value; this indicates an internal codec error.",
        data: { strategy: String(exhaustive) },
      });
    }
  }
};
