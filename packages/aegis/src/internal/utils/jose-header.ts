import { B64 } from "@lindorm/b64";
import { B64U } from "../constants/format.js";
import { TOKEN_HEADER_ALGORITHMS } from "../constants/header.js";
import { JoseError } from "../../errors/index.js";
import { KIT_CAPABILITIES } from "../registry/kit-capabilities.js";
import type { Dict } from "@lindorm/types";
import { headerByJose } from "../header/header-registry.js";
import type { WireTokenHeader, WireTokenHeaderOptions } from "../../types/index.js";

/**
 * Serialise an ASSEMBLED JOSE protected header (`buildJoseHeader`'s output) to its
 * base64url segment: the last-line invariants, the byte fields to base64url, JSON.
 *
 * It takes the WIRE header, not domain options — assembling one is
 * `buildJoseHeader`'s job, and every JOSE kit goes through it, so the encoder
 * neither merges nor translates. That also means the KEY ORDER it is handed is the
 * order it emits: the caller has already canonicalised it, and the signed bytes
 * depend on it.
 */
export const encodeJoseHeader = (header: WireTokenHeaderOptions): string => {
  if (!header.alg) {
    throw new JoseError("Algorithm is required", {
      code: "jose_header_algorithm_required",
      title: "JOSE Header Algorithm Required",
      details: "No alg was provided, so the protected JOSE header cannot be encoded.",
    });
  }
  if (!TOKEN_HEADER_ALGORITHMS.includes(header.alg)) {
    throw new JoseError(`Invalid algorithm: ${header.alg}`, {
      code: "jose_header_invalid_algorithm",
      data: { algorithm: header.alg },
      title: "JOSE Header Invalid Algorithm",
      details:
        "The requested alg is not in the set of JOSE algorithms Aegis supports, so the header cannot be encoded.",
    });
  }
  if (!header.typ) {
    throw new JoseError("Header type is required", {
      code: "jose_header_type_required",
      title: "JOSE Header Type Required",
      details: "No typ was provided, so the protected JOSE header cannot be encoded.",
    });
  }
  if (!header.kid) {
    throw new JoseError("Key ID is required", {
      code: "jose_header_key_id_required",
      title: "JOSE Header Key ID Required",
      details:
        "No kid was provided, so verifiers could not look up the signing key in Amphora; the header cannot be encoded.",
    });
  }

  // Convert Buffer fields (iv, p2s, tag) to base64url strings for JSON
  // serialization: `WireTokenHeaderOptions` carries them as Buffers,
  // `WireTokenHeader` as strings. Re-assigning an existing key keeps its position,
  // and an absent one is added as `undefined`, which JSON.stringify omits — so
  // neither the canonical order nor the parameter set moves. `alg` is validated
  // above, which is what fixes the optional `alg` to the required one.
  const claims: WireTokenHeader = {
    ...header,
    alg: header.alg,
    iv: header.iv ? B64.encode(header.iv, B64U) : undefined,
    p2s: header.p2s ? B64.encode(header.p2s, B64U) : undefined,
    tag: header.tag ? B64.encode(header.tag, B64U) : undefined,
  };

  return B64.encode(JSON.stringify(claims), B64U);
};

/**
 * Decode a base64url JOSE protected header into the REGISTERED members and the
 * ones no registry row answers for, kept APART.
 *
 * ⚠ THE SPLIT IS THE POINT. `JSON.parse` keeps every member a producer wrote, and
 * returning that object as a `WireTokenHeader` is a typed lie: the type says an
 * unregistered key cannot exist and the value carries one, so every reader
 * downstream believes a bag it cannot inspect. `unknown` is where they go — a
 * foreign issuer may legitimately write params aegis has never heard of, and
 * dropping them would hide what the token said ({@link WireHeaderBuckets}).
 *
 * The `alg`/`enc`/`typ` checks below run on the parsed object BEFORE the split,
 * because all three are registered and their refusals are about what this library
 * can process at all.
 *
 * ⛔ THE UNKNOWN BAG IS `Object.create(null)`, and both halves of that matter.
 * `JSON.parse` creates `__proto__` as an OWN data property, so it survives
 * `Object.entries`; assigning it onto a plain `{}` reaches `Object.prototype`'s
 * setter instead, which DROPS the parameter (breaking the verbatim carriage this
 * bag exists for) and leaves the bag inheriting attacker-chosen keys. A
 * null-prototype object has no setter to hit and no chain for a consumer's own
 * `unknown[key]` lookup to walk. This package already bans `in` on a
 * caller-influenced key for the same class; the ASSIGNMENT is the other half.
 */
export const decodeJoseHeader = (
  header: string,
): { header: WireTokenHeader; unknown: Dict } => {
  const string = B64.toString(header);
  const json = JSON.parse(string) as Partial<WireTokenHeader>;

  if (!json.alg || typeof json.alg !== "string") {
    throw new JoseError("Missing or invalid token header: alg", {
      code: "jose_header_alg_invalid",
      title: "JOSE Header Alg Invalid",
      details: "The decoded JOSE header has no alg, or alg is not a string.",
    });
  }
  // Allowlist enforcement: the only algorithms aegis will even attempt to
  // decode are the ones kryptos currently supports. This catches `none`,
  // RSA1_5, and any other weak or unsupported algorithm up front — well
  // before the kryptos-match check in the Kit — and with a clearer error
  // message than "algorithm mismatch".
  if (!(TOKEN_HEADER_ALGORITHMS as ReadonlyArray<string>).includes(json.alg)) {
    throw new JoseError(`Unsupported algorithm: ${json.alg}`, {
      code: "jose_header_unsupported_algorithm",
      data: { alg: json.alg },
      title: "JOSE Header Unsupported Algorithm",
      details:
        "The decoded header alg is not in the allowlist of supported algorithms, rejecting weak or disallowed algorithms such as none.",
    });
  }
  // The `enc` twin of the allowlist above, which did not exist: `alg` was checked
  // and the CONTENT encryption was not, so a header naming an unsupported (or
  // invented) AEAD passed the keyless read untouched and was refused only later,
  // by a kit's encryption-MISMATCH check, which says something else. The
  // allowlist is the `jwe` kit's declared `contentEncryption` capability.
  // Presence-gated: `enc` is a JWE parameter, and a JWS/JWT carries none.
  if (json.enc !== undefined && !KIT_CAPABILITIES.jwe.contentEncryption.has(json.enc)) {
    throw new JoseError(`Unsupported encryption: ${json.enc}`, {
      code: "jose_header_unsupported_encryption",
      data: { enc: json.enc },
      title: "JOSE Header Unsupported Encryption",
      details:
        "The decoded header enc is not one of the content-encryption algorithms this wire can carry.",
    });
  }
  // typ is OPTIONAL per RFC 7515 Section 4.1.9
  if (json.typ !== undefined && typeof json.typ !== "string") {
    throw new JoseError("Invalid token header: typ must be a string", {
      code: "jose_header_typ_invalid",
      title: "JOSE Header Typ Invalid",
      details:
        "The decoded header typ is present but is not a string, which RFC 7515 requires.",
    });
  }
  // The REGISTERED members and the rest, kept apart — see the return docstring.
  // A `Map` read (`headerByJose`), so a member off a token a stranger wrote
  // cannot resolve through `Object.prototype`.
  const registered: Dict = {};
  // Null-prototype — see the docstring. The keys come off a token a stranger wrote.
  const unknown: Dict = Object.create(null);

  for (const [key, value] of Object.entries(json)) {
    if (headerByJose(key) === undefined) {
      unknown[key] = value;
      continue;
    }

    registered[key] = value;
  }

  // Values are passed through as-is; individual Kit classes validate specific
  // ones if needed.
  return { header: registered as WireTokenHeader, unknown };
};
