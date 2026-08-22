import { CweKit } from "../../classes/CweKit.js";
import type { DomainTokenHeader } from "../../types/index.js";
import { domainTokenHeader } from "../utils/domain-header.js";

/**
 * A COSE_Encrypt0's DOMAIN header, read WITHOUT decrypting — the COSE analogue of
 * decoding a JWE's protected header for `aegis.decrypt`. `CweKit.decode` is the ONE
 * keyless COSE_Encrypt0 header reader and `domainTokenHeader` the ONE wire→domain
 * translation the verify and parse paths share.
 *
 * ⚠ `algorithm` is the one fact nothing on the wire carries: a COSE_Encrypt0 has no
 * recipients array (RFC 9052 §5.2) and label 1 holds the CONTENT encryption, so
 * `dir` is an aegis mapping of the structure rather than a value read off it.
 */
export const coseEncryptDomainHeader = (bytes: Buffer): DomainTokenHeader => {
  const header = domainTokenHeader(CweKit.decode(bytes), "cwe");

  header.algorithm = "dir";

  return header;
};
