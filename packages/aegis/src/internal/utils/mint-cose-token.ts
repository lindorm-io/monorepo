import { getUnixTime } from "@lindorm/date";
import { isDate, isString } from "@lindorm/is";
import { omitUndefined } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import type { ProfileMintOptions, SignContent, SignedJwt } from "../../types/index.js";
import { encryptCose } from "../cose/cose-encryption.js";
import { coseTyp } from "../cose/cose-typ.js";
import { signCose } from "../cose/sign-cose.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
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
}): Promise<SignedJwt> => {
  const profile = resolveProfile(name);

  // Encryption is only meaningful for encryptable profiles; an encrypt option
  // on a non-encryptable profile is a caller error, not a silent no-op.
  if (options.encrypt !== undefined && !profile.encryptable) {
    throw new AegisError("Encryption is not allowed for this profile", {
      code: "encryption_not_allowed",
      data: { profile: profile.name },
      title: "Encryption Not Allowed",
      details:
        "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
    });
  }

  // Encryption fires when the profile is encryptable AND either an explicit
  // `encrypt` option is supplied OR the content carries `sensitive_identity`.
  // COSE_Encrypt0 is direct AEAD, so the recipient key is a symmetric enc key.
  const hasSensitiveIdentity = content.sensitiveIdentity != null;
  const explicitEncrypt = options.encrypt !== undefined;
  const wantsEncryption =
    profile.encryptable && (explicitEncrypt || hasSensitiveIdentity);

  const encKryptos = wantsEncryption
    ? await deps.resolveEncKey(options.encrypt?.key, explicitEncrypt)
    : undefined;

  // `sensitive_identity` MUST NOT travel in cleartext: if it cannot be
  // encrypted, strip it before securing the CWT so it is omitted entirely.
  const signContent =
    hasSensitiveIdentity && !encKryptos
      ? (omitUndefined({ ...content, sensitiveIdentity: undefined }) as SignContent)
      : content;

  const kryptos = await deps.resolveSignKey(options.sign ?? {}, profile);

  const common = assembleCommonClaims(
    { algorithm: kryptos.algorithm, issuer: deps.issuer },
    profile,
    signContent,
    { ...(options.sign ?? {}), context: options.context },
  );
  validateProfileClaims(profile, common, {
    ...(options.context ?? {}),
    algorithm: kryptos.algorithm as any,
  });

  let token = signCose({
    kryptos,
    logger: deps.logger,
    common,
    typ: coseTyp(profile.typ),
    proprietary: options.proprietary,
    omit: options.omit,
  });

  // Sign-then-encrypt: the inner secured CWT is the COSE_Encrypt0 plaintext.
  if (encKryptos) {
    token = encryptCose({
      kryptos: encKryptos,
      logger: deps.logger,
      inner: token,
      typ: coseTyp(profile.typ),
      encryption: options.encrypt?.key?.encryption ?? deps.encryption,
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
    objectId: undefined,
    tokenId: isString(common.tokenId) ? common.tokenId : undefined,
  };
};
