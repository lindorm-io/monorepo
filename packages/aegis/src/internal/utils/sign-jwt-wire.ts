import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type {
  CertificateBindingMode,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
} from "../../types/index.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";
import { buildSignedJwt } from "./jwt-payload.js";

/**
 * Serialize an ALREADY-WIRE jose-keyed claim dict into a `SignedJwt` via the
 * transform-free `JwtKit` — the shared tail of the raw `aegis.jwt.sign` and the
 * profiled `mint` JOSE paths (formerly `JoseKit.signJwt`/`signClaims`). An
 * explicit `options.typ` wins; otherwise the typ is the tokenType-derived
 * default, reduced to the bare prefix the wire kit re-wraps into
 * `application/<prefix>+jwt`.
 */
export const signJwtWire = ({
  kryptos,
  wireClaims,
  content,
  options,
  certBindingMode,
  certificateThumbprintSha1,
  clockTolerance,
  logger,
}: {
  kryptos: IKryptos;
  wireClaims: Dict;
  content: Pick<SignJwtContent, "tokenType">;
  options: SignJwtOptions;
  certBindingMode: CertificateBindingMode;
  /** Resolved deployment default for the SHA-1 thumbprint (`x5t`) emission gate. */
  certificateThumbprintSha1: boolean;
  clockTolerance: number;
  logger: ILogger;
}): SignedJwt => {
  const fullTyp =
    options.typ != null ? options.typ : computeTypHeader(content.tokenType, "jwt");

  const token = new JwtKit({ certBindingMode, clockTolerance, kryptos, logger }).sign(
    wireClaims,
    {
      bindCertificate: options.bindCertificate,
      certificateThumbprintSha1:
        options.certificateThumbprintSha1 ?? certificateThumbprintSha1,
      header: options.header,
      omit: options.omit,
      tokenType: extractTypPrefix(fullTyp),
    },
  );

  return buildSignedJwt(token, wireClaims, options.header?.oid);
};
