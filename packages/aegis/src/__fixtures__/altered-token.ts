import type { Dict } from "@lindorm/types";
import { decode, encode, Tag } from "cbor2";

/**
 * A token ALTERED after it was issued — the one shape a verifier exists to
 * refuse, and one no aegis writer can produce.
 *
 * The rewrite is structure-preserving on purpose. A header or payload
 * alteration re-encodes a well-formed container with one member added, and a
 * signature alteration flips the bits of the last byte and nothing else — so the
 * token still parses, still names its key and still declares its algorithm, and
 * a refusal is attributable to the integrity check rather than to a decoder
 * giving up on malformed bytes. The added member is unregistered, so no read
 * gate ahead of the signature answers for it.
 *
 * ⛔ Imports nothing from `src/internal/` or `src/classes/`: `Buffer`/`JSON` for
 * JOSE, the `cbor2` package for COSE. A rewrite made through aegis's own codec
 * would prove only that aegis agrees with itself.
 */

export type TokenPart = "protected header" | "payload" | "signature";

const ALTERED_MEMBER = "altered";

/** Flip every bit of the last byte — a different value, the same length. */
const flipLastByte = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length === 0) {
    throw new Error("the segment is empty, so there is no byte to flip");
  }

  const copy = Uint8Array.from(bytes);
  copy[copy.length - 1] ^= 0xff;
  return copy;
};

const asBytes = (slot: unknown, what: string): Uint8Array => {
  if (slot instanceof Uint8Array) return slot;

  throw new Error(`the ${what} slot is not a byte string, so there is nothing to alter`);
};

const asMap = (value: unknown, what: string): Map<unknown, unknown> => {
  if (value instanceof Map) return value;

  throw new Error(`the ${what} is not a CBOR map, so no member can be added to it`);
};

const withMemberJose = (segment: string): string => {
  const decoded = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Dict;

  return Buffer.from(
    JSON.stringify({ ...decoded, [ALTERED_MEMBER]: true }),
    "utf8",
  ).toString("base64url");
};

const alterJose = (token: string, part: TokenPart): string => {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error(
      `a ${parts.length}-part serialisation has no header, payload and signature triple to alter`,
    );
  }

  const [header, payload, signature] = parts;

  switch (part) {
    case "protected header":
      return [withMemberJose(header), payload, signature].join(".");

    case "payload":
      return [header, withMemberJose(payload), signature].join(".");

    case "signature":
      return [
        header,
        payload,
        Buffer.from(flipLastByte(Buffer.from(signature, "base64url"))).toString(
          "base64url",
        ),
      ].join(".");

    default: {
      const exhaustive: never = part;
      throw new Error(`unhandled token part ${String(exhaustive)}`);
    }
  }
};

/** A member added to a COSE map under its text label, beside the integer labels it carries (RFC 9052 §1.5). */
const withMemberCose = (bstr: unknown, what: string): Uint8Array => {
  const map = asMap(decode(asBytes(bstr, what), { preferMap: true }), what);

  map.set(ALTERED_MEMBER, true);

  return encode(map);
};

const alterCose = (token: string, part: TokenPart): string => {
  let value: unknown = decode(Buffer.from(token, "base64url"), { preferMap: true });
  const tags: Array<number> = [];

  while (value instanceof Tag) {
    tags.push(Number(value.tag));
    value = value.contents;
  }

  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(
      "the token is not a four-element signed COSE structure, so it has no signature to alter",
    );
  }

  const structure: Array<unknown> = [...value];

  switch (part) {
    case "protected header":
      structure[0] = withMemberCose(structure[0], "protected header");
      break;

    case "payload":
      structure[2] = withMemberCose(structure[2], "payload");
      break;

    case "signature":
      structure[3] = flipLastByte(asBytes(structure[3], "signature"));
      break;

    default: {
      const exhaustive: never = part;
      throw new Error(`unhandled token part ${String(exhaustive)}`);
    }
  }

  // Re-framed in the tag chain the token arrived in, innermost first, so the
  // altered token reaches the same door the original does.
  let rewrapped: unknown = structure;

  for (const tag of [...tags].reverse()) {
    rewrapped = new Tag(tag, rewrapped);
  }

  return Buffer.from(encode(rewrapped)).toString("base64url");
};

/** The token with one part altered after it was issued; the wire is read off the bytes. */
export const alterToken = (token: string, part: TokenPart): string =>
  token.includes(".") ? alterJose(token, part) : alterCose(token, part);
