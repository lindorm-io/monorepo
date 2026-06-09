import { B64 } from "@lindorm/b64";
import { B64U } from "../constants/format.js";
import { TOKEN_HEADER_ALGORITHMS } from "../constants/header.js";
import { AegisError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  DecodedTokenHeader,
  TokenHeaderClaims,
  TokenHeaderOptions,
} from "../../types/index.js";
import { mapTokenHeader } from "./token-header.js";

export const encodeJoseHeader = (
  options: TokenHeaderOptions,
  cert?: CertificateHeaderFields,
): string => {
  if (!options.algorithm) {
    throw new AegisError("Algorithm is required", {
      code: "jose_header_algorithm_required",
      title: "JOSE Header Algorithm Required",
      details: "No alg was provided, so the protected JOSE header cannot be encoded.",
    });
  }
  if (!TOKEN_HEADER_ALGORITHMS.includes(options.algorithm)) {
    throw new AegisError(`Invalid algorithm: ${options.algorithm}`, {
      code: "jose_header_invalid_algorithm",
      data: { algorithm: options.algorithm },
      title: "JOSE Header Invalid Algorithm",
      details:
        "The requested alg is not in the set of JOSE algorithms Aegis supports, so the header cannot be encoded.",
    });
  }
  if (!options.headerType) {
    throw new AegisError("Header type is required", {
      code: "jose_header_type_required",
      title: "JOSE Header Type Required",
      details: "No typ was provided, so the protected JOSE header cannot be encoded.",
    });
  }
  if (!options.keyId) {
    throw new AegisError("Key ID is required", {
      code: "jose_header_key_id_required",
      title: "JOSE Header Key ID Required",
      details:
        "No kid was provided, so verifiers could not look up the signing key in Amphora; the header cannot be encoded.",
    });
  }

  const raw = mapTokenHeader(options, cert);

  // Convert Buffer fields (iv, p2s, tag) to base64url strings for JSON serialization.
  // RawTokenHeaderClaims uses Buffer for these fields; TokenHeaderClaims uses string.
  // alg is required in TokenHeaderClaims but optional in RawTokenHeaderClaims —
  // we've already validated options.algorithm above so raw.alg is guaranteed to be set.
  const claims: TokenHeaderClaims = {
    ...raw,
    alg: options.algorithm,
    iv: raw.iv ? B64.encode(raw.iv, B64U) : undefined,
    p2s: raw.p2s ? B64.encode(raw.p2s, B64U) : undefined,
    tag: raw.tag ? B64.encode(raw.tag, B64U) : undefined,
  };

  return B64.encode(JSON.stringify(claims), B64U);
};

export const decodeJoseHeader = (header: string): DecodedTokenHeader => {
  const string = B64.toString(header);
  const json = JSON.parse(string) as Partial<TokenHeaderClaims>;

  if (!json.alg || typeof json.alg !== "string") {
    throw new AegisError("Missing or invalid token header: alg", {
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
    throw new AegisError(`Unsupported algorithm: ${json.alg}`, {
      code: "jose_header_unsupported_algorithm",
      data: { alg: json.alg },
      title: "JOSE Header Unsupported Algorithm",
      details:
        "The decoded header alg is not in the allowlist of supported algorithms, rejecting weak or disallowed algorithms such as none.",
    });
  }
  // typ is OPTIONAL per RFC 7515 Section 4.1.9
  if (json.typ !== undefined && typeof json.typ !== "string") {
    throw new AegisError("Invalid token header: typ must be a string", {
      code: "jose_header_typ_invalid",
      title: "JOSE Header Typ Invalid",
      details:
        "The decoded header typ is present but is not a string, which RFC 7515 requires.",
    });
  }
  // Pass through as-is; individual Kit classes validate specific values if needed

  return json as DecodedTokenHeader;
};
