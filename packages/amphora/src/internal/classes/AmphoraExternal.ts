import { isArray } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import { AmphoraError } from "../../errors/index.js";
import type { IAmphoraExternal } from "../../interfaces/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { seedExternalConfig } from "../utils/seed-external-config.js";
import { toExternalConfig } from "../utils/to-external-config.js";
import type { AmphoraState } from "./AmphoraState.js";

/**
 * The EXTERNAL facet — many foreign issuers, sharing the Amphora's one vault,
 * Conduit and logger through {@link AmphoraState}. `add` / `remove` manage foreign
 * KEYS (⇒ `internal: false`); the `Issuer` verbs manage issuer SOURCES and their
 * per-issuer fetch / refresh.
 */
export class AmphoraExternal implements IAmphoraExternal {
  constructor(private readonly state: AmphoraState) {}

  add(kryptos: Array<IKryptos> | IKryptos): void {
    this.state.addExternalKeys(isArray(kryptos) ? kryptos : [kryptos]);
  }

  remove(id: string): void {
    this.state.removeKey(id);
  }

  async addIssuer(source: AmphoraExternalSettings): Promise<void> {
    // One issuer, one scope — an external issuer cannot also be the idp.
    this.state.assertIssuerScopeFree(source.issuer, "external");

    const entry = seedExternalConfig(source);

    // Register + enforce the `maxIssuers` cap (evicts the LRU external issuer on
    // overflow). Registration stamps `lastAccess`, so this new issuer is safe.
    this.state.addExternalEntry(entry);

    // `load` eager-fetches now; lazy issuers wait for the next refresh or a
    // find-miss on their issuer.
    if (entry.load) await this.state.loadEntry(entry);
  }

  removeIssuer(issuer: string): void {
    // The idp is not an external provider — it can only be removed via idp.clear().
    if (this.state.idpIssuer === issuer) {
      throw new AmphoraError("Cannot remove the idp via removeIssuer", {
        code: "remove_issuer_is_idp",
        data: { issuer },
        title: "Remove Issuer Is Idp",
        details: `The issuer "${issuer}" is the configured upstream idp, not an external provider. Use amphora.idp.clear() to remove it.`,
      });
    }

    const index = this.state.externalEntries.findIndex(
      (entry) => entry.issuer === issuer || entry.input.issuer === issuer,
    );
    if (index === -1) return;

    const [removed] = this.state.externalEntries.splice(index, 1);
    this.state.evictIssuer(removed.issuer ?? removed.input.issuer ?? null);
  }

  /**
   * The issuers amphora HOLDS — every registered source whose issuer has settled,
   * as a copy.
   *
   * A source registered by `openIdConfigurationUri` alone names no issuer until
   * that document is fetched, and registration is lazy by default, so it is simply
   * not an issuer yet and is omitted rather than listed with a `null`. It stays
   * registered and appears here the moment it resolves. Omitting beats throwing:
   * one unreachable peer must not take out the whole listing, which is the same
   * partial-failure tolerance `refreshAll` is built on.
   */
  issuers(): Array<AmphoraExternalConfig> {
    const result: Array<AmphoraExternalConfig> = [];

    for (const entry of this.state.externalEntries) {
      const config = toExternalConfig(entry);

      if (!config) {
        this.state.logger.debug("Skipping external source with no resolved issuer", {
          openIdConfigurationUri: entry.input.openIdConfigurationUri,
        });
        continue;
      }

      result.push(config);
    }

    return result;
  }

  refresh(issuer: string): Promise<void> {
    return this.state.refreshIssuer(issuer);
  }
}
