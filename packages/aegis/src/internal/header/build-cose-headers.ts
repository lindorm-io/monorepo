import type { CoseError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { headerByCose } from "./header-registry.js";
import { wireHeaderToCoseMap } from "./wire-header-to-cose-map.js";

/**
 * Translate and VALIDATE the two caller-controlled COSE header bags (`header` →
 * protected, `unprotected` → unprotected) into COSE integer-label maps, enforcing
 * the three RFC-9052 / COSE-consistency rules (all throw at the site, house
 * idiom). It returns the translated entries for the kit to merge into its
 * already-derived protected/unprotected maps — the ordering of the merge is the
 * kit's concern (COSE_Encrypt0 finalizes its protected header before the IV
 * exists, so it cannot be a single write here).
 *
 * `reserved` is the set of COSE labels the kit derives/computes itself (a signed
 * kit: `alg`+`kid`; the encrypt kit: `enc`/label-1 + `kid` + `iv`) — the runtime
 * backstop for the type-level Omit, since an `as any`/untyped dict can smuggle a
 * derived param past the compiler.
 *
 * The rules:
 *  1. a reserved/derived param set in EITHER bag → throw (it is key-derived);
 *  2. `crit` ⊆ protected — `crit` itself, or any param it lists, placed in the
 *     unprotected bag → throw (critical params must be integrity-protected);
 *  3. the same param in BOTH bags → throw (COSE cannot carry it twice).
 */
export const buildCoseHeaders = ({
  reserved,
  header,
  unprotected,
  error,
}: {
  reserved: Set<number>;
  header: Partial<WireTokenHeader> | undefined;
  unprotected: Partial<WireTokenHeader> | undefined;
  error: typeof CoseError;
}): {
  protectedEntries: Map<number, unknown>;
  unprotectedEntries: Map<number, unknown>;
} => {
  // Rule 2 — crit ⊆ protected (RFC 9052 §3.1). Checked on the raw wire-named bags,
  // before label translation: crit's members are wire names.
  if (unprotected && "crit" in unprotected) {
    throw new error("crit cannot be an unprotected COSE header parameter", {
      code: "cose_crit_unprotected",
      title: "COSE crit Must Be Protected",
      details:
        "RFC 9052 requires critical header parameters to be integrity-protected, so crit itself must live in the protected header, not the unprotected one.",
    });
  }

  const crit = header?.crit;
  if (Array.isArray(crit) && unprotected) {
    for (const name of crit) {
      if (typeof name === "string" && name in unprotected) {
        throw new error(`crit-listed parameter "${name}" cannot be unprotected`, {
          code: "cose_crit_param_unprotected",
          data: { parameter: name },
          title: "COSE crit Parameter Must Be Protected",
          details:
            "A parameter named in crit must be integrity-protected, so it cannot be placed in the unprotected header bucket.",
        });
      }
    }
  }

  const protectedEntries = wireHeaderToCoseMap(header);
  const unprotectedEntries = wireHeaderToCoseMap(unprotected);

  // Rule 1 — a kit-derived/computed param cannot be set by the caller in EITHER
  // bag (the runtime backstop for untyped paths; the bag TYPES already Omit these).
  for (const [entries, bucket] of [
    [protectedEntries, "header"],
    [unprotectedEntries, "unprotected"],
  ] as const) {
    for (const label of entries.keys()) {
      if (!reserved.has(label)) continue;
      const jose = headerByCose(label)?.jose ?? String(label);
      throw new error(`Header parameter "${jose}" is key-derived and cannot be set`, {
        code: "cose_reserved_header",
        data: { parameter: jose, bucket },
        title: "COSE Reserved Header Parameter",
        details:
          "This header parameter is derived from the signing/encrypting key or computed by the crypto operation, so the kit always sets it; it cannot be supplied in the header or unprotected bag.",
      });
    }
  }

  // Rule 3 — the same non-reserved param cannot appear in BOTH buckets.
  for (const label of protectedEntries.keys()) {
    if (!unprotectedEntries.has(label)) continue;
    const jose = headerByCose(label)?.jose ?? String(label);
    throw new error(`Header parameter "${jose}" set in both header and unprotected`, {
      code: "cose_duplicate_header",
      data: { parameter: jose },
      title: "COSE Duplicate Header Parameter",
      details:
        "A header parameter may live in the protected or the unprotected bucket, not both; COSE cannot carry the same parameter twice.",
    });
  }

  return { protectedEntries, unprotectedEntries };
};
