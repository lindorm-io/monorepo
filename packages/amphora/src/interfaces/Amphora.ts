import type { IKryptos } from "@lindorm/kryptos";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
  AmphoraIdpSettings,
  AmphoraInternalConfig,
  AmphoraJwks,
  AmphoraCondition,
} from "../types/index.js";

/**
 * The EXTERNAL scope — foreign issuers whose keys this service fetches (never mints).
 * `add`/`remove` manage foreign KEYS (⇒ `internal: false`); the `Issuer` verbs manage
 * the issuer SOURCES (fetch config + per-issuer refresh). Keys land in the ONE vault and
 * are found via the unified top-level `find`.
 */
export interface IAmphoraExternal {
  add(kryptos: Array<IKryptos> | IKryptos): void;
  remove(id: string): void;

  /**
   * Register an issuer source and fetch its keys — it awaits the fetch and
   * throws when it fails. There is no deferred registration, and no partial
   * one: the fetch happens first, so a failure registers nothing and never
   * spends the `maxIssuers` cap on a source that did not load.
   */
  addIssuer(source: AmphoraExternalSettings): Promise<void>;
  removeIssuer(issuer: string): void;
  /**
   * Every registered source whose issuer has SETTLED. A source registered by
   * `openIdConfigurationUri` alone carries no issuer until that document is
   * fetched — before `setup()`, or after it when a non-`required` fetch failed —
   * so it is omitted until it resolves rather than listed with a `null`, and one
   * unreachable peer never takes out the whole listing.
   */
  issuers(): Array<AmphoraExternalConfig>;
  refresh(issuer: string): Promise<void>;
}

/**
 * The IDP scope — the ONE upstream identity provider, a distinguished singleton external
 * issuer. `set` registers or replaces it (swapping evicts the previous idp's keys); its
 * keys are external-provenance in the unified vault. A management + config view over the
 * same external fetch machinery. `config` throws when no idp is set, and again when one
 * is set but amphora has not settled its issuer.
 *
 * The idp is always `required` — `set` awaits its fetch and throws, and
 * `amphora.setup()` throws when a construction-declared idp cannot be resolved.
 */
export interface IAmphoraIdp {
  /**
   * Register or REPLACE the upstream, ALL-OR-NOTHING: the new source is resolved
   * and fetched before anything is swapped, so a failure throws with the
   * previous idp untouched — same config, same keys, still serving. A successful
   * swap evicts the previous idp's keys.
   */
  set(source: AmphoraIdpSettings): Promise<void>;
  /**
   * Throws `idp_not_configured` when no upstream is registered, and
   * `idp_issuer_unresolved` when one is registered by `openIdConfigurationUri`
   * alone and that document has not been fetched yet (before `setup()`). The
   * caller named ONE provider, so there is nothing sensible to hand back for
   * either.
   */
  config(): AmphoraExternalConfig;
  refresh(): Promise<void>;
  clear(): void;
}

/**
 * Three issuer scopes, named on the instance: `internal` (this service's OWN
 * identity), `external` (foreign issuers it fetches from) and `idp` (the ONE
 * upstream identity provider).
 */
export interface IAmphora {
  /**
   * This service's own identity, `{ issuer, jwksUri }` derived from the `issuer`
   * setting — SINGULAR, and `null` for a verify-only service that declared none.
   */
  internal: AmphoraInternalConfig | null;
  jwks: AmphoraJwks;
  vault: Array<IKryptos>;

  external: IAmphoraExternal;
  idp: IAmphoraIdp;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  env(keys: Array<string> | string): void;
  filter(query: AmphoraCondition): Promise<Array<IKryptos>>;
  filterSync(query: AmphoraCondition): Array<IKryptos>;
  find(query: AmphoraCondition): Promise<IKryptos>;
  /**
   * UNFILTERED lookup by key id — no `isActive` filter, no publish gate, because
   * an artifact naming a `kid` must still resolve to a key that has since
   * expired or was never published (the caller's floor owns the time policy).
   *
   * Key ids are unique PER ISSUER. Pass `issuer` whenever it is known — from the
   * artifact's own `iss`, or the issuer the verifier expects — and the lookup is
   * NARROWED to that issuer's keys. It never widens and never falls back: a
   * scoped miss throws rather than retrying unscoped, because a fallback would
   * mean an id the claimed issuer does not hold gets answered by some other
   * issuer's key.
   *
   * Called with no issuer, an id that matches keys from MORE THAN ONE issuer
   * throws `kryptos_ambiguous_id` — there is nothing to choose with.
   */
  findById(id: string, issuer?: string): Promise<IKryptos>;
  findByIdSync(id: string, issuer?: string): IKryptos;
  findSync(query: AmphoraCondition): IKryptos;
  refresh(): Promise<void>;
  setup(): Promise<void>;

  canEncrypt(): boolean;
  canDecrypt(): boolean;

  canSign(): boolean;
  canVerify(): boolean;
}
