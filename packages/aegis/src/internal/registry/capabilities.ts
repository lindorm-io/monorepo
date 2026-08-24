/**
 * The FOURTH table. The parameter registries describe DOMAIN CONCEPTS and cannot
 * express "a CWE is `dir`-only" or "a COSE `cnf` has no `jkt`" — facts about a KIT,
 * not about a claim or a header parameter.
 *
 * Capabilities are queried BEFORE key resolution, so an unsupported request becomes
 * aegis's own named refusal rather than a foreign error surfacing from
 * `@lindorm/aes` several layers down.
 */

import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { CnfMember } from "../claims/cnf-members.js";
import type { Wire } from "./wire.js";

/**
 * The confirmation members aegis can put on a wire (RFC 7800 §3.1, RFC 8747 §3.1).
 *
 * ⚠ DERIVED, not restated: the JOSE names of `internal/claims/cnf-members.ts`'s one
 * declaration, plus the `ckt` no kit carries. See that file for why `ckt` is named.
 */
export type { CnfMember } from "../claims/cnf-members.js";

export type KitCapabilities = {
  /** The wire this kit serialises to. */
  wire: Wire;
  /**
   * The key-management algorithms the kit can use. Empty for a kit that performs
   * no key management (every signing/MAC kit).
   */
  keyManagement: ReadonlySet<KryptosAlgorithm>;
  /** The content-encryption algorithms the kit can use. Empty for a signing kit. */
  contentEncryption: ReadonlySet<KryptosEncryption>;
  /**
   * The confirmation members the kit's claims layer can carry. Empty for the
   * OPAQUE formats (jws/cws), which have no claims layer of their own.
   */
  cnfMembers: ReadonlySet<CnfMember>;
  /**
   * The wire header parameters the KIT stamps itself, in the JOSE spelling. A caller
   * value for one of these is refused, or silently overwritten where the kit does
   * not yet enforce it.
   */
  reserved: ReadonlyArray<string>;
};
