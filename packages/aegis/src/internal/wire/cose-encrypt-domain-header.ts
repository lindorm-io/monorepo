import { CweKit } from "../../classes/CweKit.js";
import type { DomainTokenHeader } from "../../types/index.js";
import { domainTokenHeader } from "../utils/domain-header.js";

/**
 * A COSE_Encrypt0's DOMAIN header, read WITHOUT decrypting — the COSE analogue of
 * decoding a JWE's protected header for `aegis.decrypt`.
 *
 * It replaces a hand-written 24-field domain literal that decoded the structure a
 * second time, merged the unprotected `kid` unconditionally (no allowlist, so an
 * unprotected `typ` or `cty` would have been merged too the day one appeared),
 * and hardcoded `contentType: undefined` / `tokenType: undefined` even though the
 * kit stamps both. Every one of those is now the shared translation's answer:
 * `CweKit.decode` is the ONE keyless COSE_Encrypt0 header reader, and
 * `domainTokenHeader` the ONE wire→domain translation the verify and parse paths
 * use.
 *
 * `algorithm` is the one fact no header parameter carries. RFC 9052 §5.2 defines
 * COSE_Encrypt0 as single-recipient DIRECT encryption: label 1 holds the CONTENT
 * encryption (translated to `encryption`) and there is no key-management
 * parameter at all, so `dir` is true of the STRUCTURE rather than read off it —
 * which is also what the JOSE twin reports for the same operation.
 */
export const coseEncryptDomainHeader = (bytes: Buffer): DomainTokenHeader => {
  const header = domainTokenHeader(CweKit.decode(bytes), "cwe");

  header.algorithm = "dir";

  return header;
};
