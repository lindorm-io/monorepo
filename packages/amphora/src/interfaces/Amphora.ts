import type { IKryptos } from "@lindorm/kryptos";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
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

  addIssuer(source: AmphoraExternalSettings): Promise<void>;
  removeIssuer(issuer: string): void;
  issuers(): Array<AmphoraExternalConfig>;
  refresh(issuer: string): Promise<void>;
}

/**
 * The IDP scope — the ONE upstream identity provider, a distinguished singleton external
 * issuer. `set` registers or replaces it (swapping evicts the previous idp's keys); its
 * keys are external-provenance in the unified vault. A management + config view over the
 * same external fetch machinery. `config` throws when no idp is set.
 */
export interface IAmphoraIdp {
  set(source: AmphoraExternalSettings): Promise<void>;
  config(): AmphoraExternalConfig;
  refresh(): Promise<void>;
  clear(): void;
}

export interface IAmphora {
  config: Array<AmphoraInternalConfig>;
  domain: string | null;
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
