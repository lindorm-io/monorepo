import type { Dict } from "@lindorm/types";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";
import type { DomainTokenHeader } from "../header/domain-header.js";

/**
 * The `aegis.decrypt` result (Bit 3/4) — CONFIDENTIAL but NOT sender-authenticated:
 * a decrypted claims set (or opaque plaintext) with no inner signature checked.
 * Same domain shape as {@link VerifiedToken}, minus the authenticity guarantee
 * (no `profile`/`sensitive`/`delegation`/`dpop` sugar, which the verify pipeline
 * derives). Always an encrypted outer format.
 */
export type DecryptedToken<C extends Dict = Dict> = {
  format: "jwe" | "cwe";
  /** Set when the decrypted plaintext is itself a nested token. */
  inner?: "jwt" | "cwt" | "cwm" | "jws" | "cws";
  contentType?: string;
  header: DomainTokenHeader;
  claims: DomainClaims;
  custom: C;
  raw?: Buffer | string;
  wire?: { payload: Dict };
  token: string;
};
