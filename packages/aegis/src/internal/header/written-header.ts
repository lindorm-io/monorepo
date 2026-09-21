import type { Dict } from "@lindorm/types";

/**
 * The protected header AS THE PRODUCER WROTE IT — the registered parameters and the
 * ones no registry row answers for, in one bag.
 *
 * ⛔ IT EXISTS BECAUSE THE READ SIDE SPLITS A HEADER THE PRODUCER DID NOT. A kit
 * result reports registered parameters in its typed bag and the rest in `custom`,
 * which is right for a caller and wrong for any rule asking "does this header CARRY
 * parameter X". `validateCrit`'s presence rule is exactly that question (RFC 9052
 * §3.1), and asked of the typed bag alone it answers `no` for every CUSTOM
 * parameter — so a reader refuses tokens this package itself mints.
 *
 * ⚠ ONE EXPRESSION for `verify`/`decrypt` and both keyless `parse` doors: a rule
 * enforced at one door and not the other is an accident of which door a caller
 * used, so any reader asking a presence question about the header comes through
 * here.
 * pinned: `custom-header-params.test.ts`, `custom-header-params.read.test.ts`,
 * and `Aegis.critical-header.feature` "a token this library signs can be read
 * back by its own keyless reader".
 *
 * ⛔⛔ THE REGISTERED BAG SPREADS LAST, AND THE ORDER IS A SECURITY PROPERTY. The
 * two bags are NOT disjoint: on COSE the custom bag is keyed by `String(label)`
 * (`internal/header/cose-wire-header.ts`), which is the same string space a JOSE
 * name lives in, and `joseByCose` resolves a TSTR label only through
 * `byCoseName` — the private-use parameters alone. So a stranger appending the
 * TEXT label `"alg"` or `"crit"` beside the genuine INTEGER labels 1 and 2 gets a
 * key here that collides with the registered parameter's own name.
 *
 * ⇒ Spread `custom` last and the FOREIGN spelling wins: `CwtKit.decode` on a signed
 * token with a text `"alg"` and `"crit"` appended reports `merged.alg` `"HS256"`
 * over a signed `ES512`, and `merged.crit` as the stranger's list. `aegis.parse`
 * checks no signature, so RFC 9052 §3.1's rule is satisfied by a `crit` the issuer
 * never wrote. Registered LAST means the signed parameter always wins.
 * pinned: `custom-header-params.read.test.ts#a TSTR label spelled like a
 * registered parameter cannot shadow it`.
 *
 * ⚠ SPREAD, not assignment: `custom` may carry an own `__proto__` off a foreign
 * token, and object spread uses CreateDataProperty, so it lands as an ordinary
 * own key here rather than as this bag's prototype.
 */
export const writtenHeader = (header: Dict, custom: Dict): Dict => ({
  ...custom,
  ...header,
});
