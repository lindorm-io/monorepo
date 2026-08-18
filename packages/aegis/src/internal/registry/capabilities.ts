/**
 * The FOURTH table. The three parameter registries describe DOMAIN CONCEPTS and
 * structurally cannot express "a CWE is `dir`-only", "a COSE `cnf` has no `jkt`",
 * "a Mac0 is not a Sign1" — those are facts about a KIT, not about a claim or a
 * header parameter. Without a home, that knowledge stays scattered as
 * `if (wire === …)` branches, which is exactly where it lives today.
 *
 * Capabilities are meant to be queried BEFORE key resolution, so an unsupported
 * request becomes aegis's own named refusal rather than a foreign error surfacing
 * from `@lindorm/aes` several layers down.
 */

import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { CnfMember } from "../claims/cnf-members.js";
import type { Wire } from "./wire.js";

/**
 * The RFC 7800 / RFC 8747 confirmation members aegis can put on a wire.
 *
 * ⚠ DERIVED, not restated. It used to be a hand-written union HERE, a third copy
 * of the five member names beside the translator's two tables; it is now the JOSE
 * names of `internal/claims/cnf-members.ts`'s one declaration, plus the `ckt` no
 * kit carries. See that file for why `ckt` is named at all.
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
  /** Whether the kit can bind an X.509 certificate to the token it produces. */
  certificateBinding: boolean;
  /** Whether the kit's wire structure HAS an unauthenticated header bucket. */
  unprotectedBucket: boolean;
  /**
   * The wire header parameters the KIT stamps itself. A caller value for one of
   * these is refused (or, where the kit does not yet enforce it, silently
   * overwritten) — the list is the JOSE spelling, since the domain layer speaks
   * JOSE wire.
   */
  reserved: ReadonlyArray<string>;
};
