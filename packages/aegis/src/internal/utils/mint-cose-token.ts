import { getUnixTime } from "@lindorm/date";
import { isDate, isString } from "@lindorm/is";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { ProfileMintOptions, SignContent, SignedToken } from "../../types/index.js";
import { encryptCose } from "../cose/cose-encryption.js";
import { coseTyp } from "../cose/cose-typ.js";
import { signCose } from "../cose/sign-cose.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { extractTypPrefix } from "./compute-typ-header.js";
import { mergeContentClaims } from "./merge-content-claims.js";
import { validateProfileClaims } from "./validate-profile-claims.js";

/**
 * The COSE encoder. Consumes the SAME domain-keyed common claims
 * (assembleCommonClaims) and profile validation as the JOSE path; only the
 * wire encoding differs — a secured CWT (COSE_Sign1 / COSE_Mac0), optionally
 * wrapped in a COSE_Encrypt0 (sign-then-encrypt), mirroring the JOSE
 * sign-then-encrypt path. The token bytes are base64url-encoded so the
 * string-token API is preserved.
 */
export const mintCoseToken = async ({
  name,
  content,
  options,
  deps,
}: {
  name: string;
  content: SignContent;
  options: ProfileMintOptions;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const profile = resolveProfile(name);

  // A verify-only profile cannot be minted on this wire either — `mintToken`
  // dispatches here BEFORE it resolves the profile, so the COSE encoder owns
  // the same refusal rather than inheriting it.
  if (profile.use === "verify") {
    throw new AegisDomainError("Profile cannot be minted", {
      code: "jwt_profile_not_mintable",
      data: { profile: profile.name, use: profile.use },
      title: "JWT Profile Not Mintable",
      details:
        "This token profile declares itself verify-only: it exists to verify a token issued elsewhere, so it cannot be used to mint one. Use the profile that owns the artifact you are issuing.",
    });
  }

  // Encryption is only meaningful for encryptable profiles; an encrypt option
  // on a non-encryptable profile is a caller error, not a silent no-op.
  if (options.encrypt !== undefined && !profile.encryptable) {
    throw new AegisDomainError("Encryption is not allowed for this profile", {
      code: "encryption_not_allowed",
      data: { profile: profile.name },
      title: "Encryption Not Allowed",
      details:
        "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
    });
  }

  // Encryption fires when the profile is encryptable AND either an explicit
  // `encrypt` option is supplied OR the content carries `sensitive` fields.
  // COSE_Encrypt0 is direct AEAD, so the recipient key is a symmetric enc key.
  const hasSensitive = content.sensitive != null;
  const explicitEncrypt = options.encrypt !== undefined;
  const wantsEncryption = profile.encryptable && (explicitEncrypt || hasSensitive);

  const encKryptos = wantsEncryption
    ? await deps.resolveEncKey(options.encrypt?.key, explicitEncrypt)
    : undefined;

  // The sensitive fields MUST NOT travel in cleartext: if they cannot be
  // encrypted, strip them before securing the CWT so they are omitted entirely.
  const signContent =
    hasSensitive && !encKryptos
      ? (omitUndefined({ ...content, sensitive: undefined }) as SignContent)
      : content;

  const kryptos = await deps.resolveSignKey(options.sign ?? {}, profile);

  const common = assembleCommonClaims(
    { algorithm: kryptos.algorithm, issuer: deps.issuer, lifetime: options.lifetime },
    profile,
    signContent,
    { ...(options.sign ?? {}), context: options.context },
  );
  validateProfileClaims(profile, common, {
    ...(options.context ?? {}),
    algorithm: kryptos.algorithm as any,
  });

  // The SAME merge the JOSE encoder runs — both content buckets, not just
  // `sensitive`. This used to drop `content.profile` entirely.
  const commonWithContent = mergeContentClaims(common, signContent);

  // D6: the WRITE path selects the COSE kit by the explicit format (`cwt` =
  // COSE_Sign1 / asymmetric, `cwm` = COSE_Mac0 / symmetric). `mintToken` routes
  // both here; the kit's class gate is the backstop, so `format: "cwt"` with a
  // symmetric key throws instead of silently MAC-ing.
  const format = options.format === "cwm" ? "cwm" : "cwt";

  // The kit builds the media type from the bare PREFIX; reduce the profile's full
  // COSE typ (`application/at+cwt` / `application/cwt`) to that prefix.
  const typPrefix = extractTypPrefix(coseTyp(profile.typ), format);

  let token = signCose({
    kryptos,
    logger: deps.logger,
    common: commonWithContent,
    tokenType: typPrefix,
    // The caller's protected header bag. `ProfileMintOptions.sign` is the JOSE
    // envelope, which has no `unprotected` bucket — that one is reachable only
    // through the raw `aegis.cwt` namespace.
    header: options.sign?.header,
    proprietary: options.proprietary,
    // mint's own `omit` controls the wire; a per-sign omit is a fallback — the
    // JOSE encoder has always honoured both.
    omit: options.omit ?? options.sign?.omit,
    format,
  });

  // Sign-then-encrypt: the inner secured CWT/CWM is the COSE_Encrypt0 plaintext.
  // The outer COSE_Encrypt0's typ is cosmetic (the read path decrypts then verifies
  // the inner token), so it carries the same profile prefix in the `+cwe` family;
  // its `cty` (label 3) is stamped `application/cwt` (RFC 8392, mirroring the
  // JOSE `cty: JWT`) so the read side reconstructs the plaintext to the inner
  // token BYTES rather than the inferred octet blob.
  if (encKryptos) {
    token = encryptCose({
      kryptos: encKryptos,
      logger: deps.logger,
      inner: token,
      tokenType: typPrefix,
      cty: "application/cwt",
      defaultEncryption: deps.defaultEncryption,
      proprietary: options.proprietary,
    });
  }

  const expiresAt = isDate(common.expiresAt) ? common.expiresAt : undefined;
  const expiresOn = expiresAt ? getUnixTime(expiresAt) : undefined;

  return {
    token: token.toString("base64url"),
    expiresAt,
    expiresIn: expiresOn ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    // The OUTER wire: a bare CWT/CWM, or a COSE_Encrypt0 (`cwe`) when
    // sign-then-encrypted — mirroring the read side's outer-format report.
    format: encKryptos ? "cwe" : format,
    objectId: undefined,
    tokenId: isString(common.tokenId) ? common.tokenId : undefined,
  };
};
