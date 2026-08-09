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
   * throws when it fails. There is no deferred registration.
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
  findById(id: string): Promise<IKryptos>;
  findByIdSync(id: string): IKryptos;
  findSync(query: AmphoraCondition): IKryptos;
  refresh(): Promise<void>;
  setup(): Promise<void>;

  canEncrypt(): boolean;
  canDecrypt(): boolean;

  canSign(): boolean;
  canVerify(): boolean;
}
