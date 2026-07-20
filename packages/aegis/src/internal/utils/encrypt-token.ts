import { isBuffer, isString } from "@lindorm/is";
import { AegisError } from "../../errors/index.js";
import type { EncryptData, EncryptOptions, EncryptedToken } from "../../types/index.js";
import { domainToCose, domainToJose } from "../claims/translate.js";
import { encodeCbor } from "../cose/cbor.js";
import { encryptCose } from "../cose/cose-encryption.js";
import { encodeCwtClaims } from "../cose/cwt-claims.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyOmit } from "./apply-omit.js";
import { encryptJwe } from "./encrypt-jwe.js";

/**
 * The COSE_Encrypt0 `typ` (label 16) stamped on a domain-CLAIMS `cwe`. It is the
 * read-side discriminant: `decryptToken` translates the plaintext back to domain
 * claims when the header carries this typ, and returns opaque bytes otherwise.
 * A JWE tells the same two apart by the kit-computed `cty` (`application/json`).
 */
export const COSE_CLAIMS_TYP = "application/cwt";

/**
 * The domain encrypt pipeline (`aegis.encrypt`) — the mirror of `signToken`, but
 * pure CONFIDENTIALITY: domain claims → wire (`domainToJose`/`domainToCose`) →
 * `JweKit`/`CweKit.encrypt` with NO inner signature. A `Buffer`/`string` payload
 * is opaque and passes through untouched; a plain object is pruned of empty
 * claims at this emission boundary (default `"empty"`) before it is serialised,
 * matching the mint/sign wires. The encoding seam dispatches on `format`.
 */
export const encryptToken = async ({
  data,
  options,
  deps,
}: {
  data: EncryptData;
  options: EncryptOptions;
  deps: AegisDeps;
}): Promise<EncryptedToken> => {
  const kryptos = await deps.resolveEncryptKey(options.key);
  const encryption = options.key?.encryption ?? deps.encryption;
  const format = options.format ?? "jwe";
  const opaque = isBuffer(data) || isString(data);

  switch (format) {
    case "jwe": {
      const payload = isString(data)
        ? data
        : isBuffer(data)
          ? data.toString("utf8")
          : JSON.stringify(domainToJose(applyOmit(data, options.omit)));

      const { token } = encryptJwe({
        kryptos,
        data: payload,
        options: {
          bindCertificate: options.bindCertificate,
          header: options.header,
          tokenType: options.type,
        },
        encryption,
        certBindingMode: deps.certBindingMode,
        certificateThumbprintSha1: deps.certificateThumbprintSha1,
        logger: deps.logger,
      });

      return { format, token };
    }

    case "cwe": {
      const inner = opaque
        ? isBuffer(data)
          ? data
          : Buffer.from(data, "utf8")
        : Buffer.from(
            encodeCbor(
              encodeCwtClaims(domainToCose(applyOmit(data, options.omit)), {
                proprietary: options.proprietary,
              }),
            ),
          );

      const token = encryptCose({
        kryptos,
        logger: deps.logger,
        inner,
        // A claims set is marked so decrypt can translate it back; opaque bytes
        // keep the caller's `type` (if any) and are returned verbatim.
        typ: opaque ? options.type : COSE_CLAIMS_TYP,
        encryption,
        proprietary: options.proprietary,
      });

      return { format, token: token.toString("base64url") };
    }

    default: {
      const exhaustive: never = format;
      throw new AegisError("Unsupported encrypt format", {
        code: "unsupported_encrypt_format",
        data: { format: String(exhaustive) },
        title: "Unsupported Encrypt Format",
        details:
          "aegis.encrypt supports only the jwe and cwe formats; symmetric at-rest encryption is a separate surface (aegis.aes).",
      });
    }
  }
};
