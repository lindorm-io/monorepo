/**
 * Builds a process-global `Symbol.for` key namespaced under the lindorm URN
 * scheme — `urn:lindorm:<pkg>:<kind>:<name>` — mirroring the error-type URN
 * convention (`urn:lindorm:<pkg>:error:<code>`).
 *
 * The global symbol registry is shared with all third-party code in the
 * process, so unqualified keys (e.g. `Symbol.for("Kryptos")`) risk collisions.
 * Namespacing every lindorm brand/marker/source symbol keeps them collision-safe,
 * consistent, and greppable — while still resolving to the SAME symbol across
 * duplicate installs of a package (which is what brands rely on).
 *
 * `kind` is conventionally one of `"brand"` (class-identity brand), `"marker"`
 * (internal tagging symbol), or `"source"` (DI/source key).
 */
export const lindormSymbol = (pkg: string, kind: string, name: string): symbol =>
  Symbol.for(`urn:lindorm:${pkg}:${kind}:${name}`);
