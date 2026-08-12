import type { DomainProtectedHeader, WireProtectedHeader } from "../../types/index.js";
import { mapTokenHeader } from "./token-header.js";

/**
 * Translate the caller's DOMAIN-named header bag into the JOSE-named wire bag the
 * kits take. The kits are pure wire — they never see a domain name — so this is
 * the single crossing point, and it runs the same registry-driven
 * {@link mapTokenHeader} pass the kit-derived fields do (canonical sort included,
 * because the signed header bytes depend on the key order).
 *
 * The kit-owned parameters cannot arrive here: {@link DomainProtectedHeader}
 * omits them at the type level, and each kit re-refuses them at runtime from its
 * own capability table.
 */
export const domainHeaderToWire = (
  header: DomainProtectedHeader | undefined,
): WireProtectedHeader | undefined =>
  header ? (mapTokenHeader(header) as WireProtectedHeader) : undefined;
