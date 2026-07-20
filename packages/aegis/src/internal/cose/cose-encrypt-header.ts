import type { KryptosEncryption } from "@lindorm/kryptos";
import type { DomainTokenHeader } from "../../types/index.js";
import { coseByJose } from "../header/header-registry.js";
import { Tag, decodeCbor } from "./cbor.js";
import { coseLabelToEnc } from "./enc-labels.js";
import { COSE_TAG, decodeProtectedHeader } from "./structures.js";

// Strip an optional outer CWT tag (61) to reach the COSE_Encrypt0 structure —
// the read twin of `cose-encryption.ts`'s private `innerCose`.
const innerEncrypt0 = (value: unknown): Tag | undefined => {
  const cose =
    value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;
  return cose instanceof Tag && cose.tag === COSE_TAG.encrypt0 ? cose : undefined;
};

/**
 * Read a COSE_Encrypt0's header into the DOMAIN header shape WITHOUT decrypting —
 * the COSE analogue of decoding a JWE's protected header for `aegis.decrypt`.
 * COSE_Encrypt0 is direct AEAD, so the protected `alg` (label 1) is the CONTENT
 * encryption (mapped to `encryption`, with `algorithm` fixed to `dir`); `typ`
 * (label 16) and the unprotected `kid` (label 4) round out the header. `typ`
 * doubles as the read-side content-type discriminant (`decryptToken` uses it to
 * tell a translated CWT claims map from opaque bytes). Absent fields are
 * `undefined`, matching the JOSE `DomainTokenHeader`.
 */
export const readCoseEncryptHeader = (bytes: Buffer): DomainTokenHeader => {
  const cose = innerEncrypt0(decodeCbor(bytes));
  const contents = cose?.contents;

  const protectedBytes = Array.isArray(contents) ? contents[0] : undefined;
  const unprotected = Array.isArray(contents)
    ? (contents[1] as Map<number, unknown> | undefined)
    : undefined;

  const protectedMap =
    protectedBytes instanceof Uint8Array
      ? decodeProtectedHeader(Buffer.from(protectedBytes))
      : undefined;

  const encLabel = protectedMap?.get(coseByJose("alg"));
  const typ = protectedMap?.get(coseByJose("typ"));
  const kid = unprotected?.get(coseByJose("kid"));

  const encryption: KryptosEncryption | undefined =
    typeof encLabel === "number" ? coseLabelToEnc(encLabel) : undefined;

  return {
    algorithm: "dir",
    baseFormat: undefined,
    certificateChain: undefined,
    certificateThumbprint: undefined,
    certificateThumbprintSha1: undefined,
    certificateUrl: undefined,
    contentType: undefined,
    critical: [],
    encryption,
    headerType: typeof typ === "string" ? typ : undefined,
    initialisationVector: undefined,
    jwk: undefined,
    jwksUri: undefined,
    keyId: kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined,
    objectId: undefined,
    partyProducer: undefined,
    partyRecipient: undefined,
    pbkdfIterations: undefined,
    pbkdfSalt: undefined,
    publicEncryptionJwk: undefined,
    publicEncryptionTag: undefined,
    tokenType: undefined,
    zip: undefined,
  };
};
