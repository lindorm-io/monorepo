import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { AegisError } from "../../errors/index.js";
import type { DecryptOptions, DecryptedToken, TokenContent } from "../../types/index.js";
import { coseToDomain, joseToDomain } from "../claims/translate.js";
import { decodeCbor } from "../cose/cbor.js";
import { readCoseEncryptHeader } from "../cose/cose-encrypt-header.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  isEncryptedCose,
} from "../cose/cose-encryption.js";
import { decodeCwtClaims } from "../cose/cwt-claims.js";
import type { AegisDeps } from "./aegis-deps.js";
import type { DomainClaims } from "./extract-claims.js";
import { COSE_CLAIMS_TYP } from "./encrypt-token.js";
import { rawDecryptJwe } from "./raw-decrypt-jwe.js";
import { parseTokenHeader } from "./token-header.js";

/**
 * The domain decrypt pipeline (`aegis.decrypt`) — CONFIDENTIALITY only, with NO
 * signature check (unlike `verify`, which decrypts then REQUIRES a signed inner).
 * Auto-detects the encrypted outer format, resolves the recipient key by the
 * ciphertext's own `kid`, decrypts, and translates the plaintext back to domain
 * claims. A plaintext that was opaque bytes (not a domain claims set) is returned
 * verbatim under `raw`. A non-encrypted token is refused — decrypt is not a
 * general reader (use `verify`/`parse`).
 */
export const decryptToken = async <C extends Dict = Dict>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: DecryptOptions;
  deps: AegisDeps;
}): Promise<DecryptedToken<C>> => {
  if (JweKit.isJwe(token)) {
    const {
      header: wireHeader,
      payload,
      token: echoed,
    } = await rawDecryptJwe<TokenContent>({
      jwe: token,
      options: { key: options.key },
      deps,
    });

    // The kit returns the WIRE header (R1); the domain `DecryptedToken` carries
    // the DOMAIN-named header, so translate here.
    const header = parseTokenHeader(wireHeader);

    // A JWE tells a translated claims set from opaque plaintext by the
    // kit-computed `cty`: `aegis.encrypt` hands a claims set to JweKit as an
    // object, which the codec stamps `application/json` and reconstructs to a Dict.
    if (header.contentType?.startsWith("application/json")) {
      const { claims, custom } = joseToDomain(payload as Dict);
      return {
        format: "jwe",
        header,
        contentType: header.contentType,
        claims: claims as DomainClaims,
        custom: custom as C,
        token: echoed,
      };
    }

    return {
      format: "jwe",
      header,
      contentType: header.contentType,
      claims: {} as DomainClaims,
      custom: {} as C,
      raw: payload as Buffer | string,
      token: echoed,
    };
  }

  if (!token.includes(".")) {
    const bytes = Buffer.from(token, "base64url");
    if (isEncryptedCose(bytes)) {
      const header = readCoseEncryptHeader(bytes);

      const kryptos = await deps.resolveDecryptKey(
        decodeEncryptedCoseKid(bytes),
        undefined,
        options.key,
      );
      const payload = decryptCose({ kryptos, logger: deps.logger, token: bytes });

      // The COSE_Encrypt0 `typ` is the discriminant: a domain claims set is
      // stamped `COSE_CLAIMS_TYP`, opaque bytes carry the caller's `type` (or none).
      if (header.headerType === COSE_CLAIMS_TYP) {
        const { claims, custom } = coseToDomain(
          decodeCwtClaims(decodeCbor<Map<unknown, unknown>>(payload)),
        );
        return {
          format: "cwe",
          header,
          contentType: header.headerType,
          claims: claims as DomainClaims,
          custom: custom as C,
          token,
        };
      }

      return {
        format: "cwe",
        header,
        contentType: header.headerType,
        claims: {} as DomainClaims,
        custom: {} as C,
        raw: payload,
        token,
      };
    }
  }

  throw new AegisError("Token is not encrypted", {
    code: "decrypt_requires_encrypted",
    debug: { token: sanitiseToken(token) },
    title: "Decrypt Requires Encrypted Token",
    details:
      "aegis.decrypt reads an encrypted token (a JWE or a COSE_Encrypt0). This token is neither — read a signed token with aegis.verify or aegis.parse.",
  });
};
