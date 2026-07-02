import { lindormSymbol } from "@lindorm/utils";

/**
 * Global-registry brand for `Kryptos` instances. Because it is created with
 * `Symbol.for` (via `lindormSymbol`), every copy of `@lindorm/kryptos` loaded in
 * a process (e.g. a duplicated/dual install where a consumer resolves a different
 * physical copy) resolves the SAME symbol. A key created by one copy is therefore
 * recognised by the `KryptosKit` guards running in another copy — unlike
 * `instanceof`, which compares per-copy class identities and fails across
 * duplicate installs.
 */
export const KRYPTOS_BRAND = lindormSymbol("kryptos", "brand", "kryptos");
