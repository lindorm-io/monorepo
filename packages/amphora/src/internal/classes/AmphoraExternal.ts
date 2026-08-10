import { isArray } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import { AmphoraError } from "../../errors/index.js";
import type { IAmphoraExternal } from "../../interfaces/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { toExternalConfig } from "../utils/to-external-config.js";
import type { AmphoraState } from "./AmphoraState.js";

/**
 * The EXTERNAL facet — many foreign issuers, sharing the Amphora's one vault,
 * Conduit and logger through {@link AmphoraState}. `add` / `remove` manage foreign
 * KEYS (⇒ `internal: false`, and each must carry its OWN issuer — nothing of ours
 * is stamped on a foreign key); the `Issuer` verbs manage issuer SOURCES and their
 * per-issuer fetch / refresh. Both key verbs are scoped to `(id, issuer)`, because
 * a kid is unique only per issuer — and both refuse to cross provenance: a slot
 * holding a key of OURS throws `kryptos_provenance_conflict` rather than being
 * replaced or deleted through here. See `AmphoraState.assertProvenance`.
 */
export class AmphoraExternal implements IAmphoraExternal {
  constructor(private readonly state: AmphoraState) {}

  add(kryptos: Array<IKryptos> | IKryptos): void {
    this.state.addExternalKeys(isArray(kryptos) ? kryptos : [kryptos]);
  }

  remove(id: string, issuer: string): void {
    this.state.removeKey(id, issuer);
  }

  /**
   * Register an issuer source and fetch its keys. There is no deferred
   * registration: a source amphora holds is a source amphora has fetched.
   *
   * IDEMPOTENT BY ISSUER, sequentially and concurrently. Registering an issuer
   * amphora already holds REPLACES it rather than adding a second entry beside
   * it, and concurrent calls for one issuer share a single in-flight
   * registration. A caller cannot do this itself: registration flows are
   * check-then-act with an `await` in the middle, so two concurrent first-time
   * authentications for one client both see "not registered".
   *
   * A failure THROWS, whatever `required` says — `required` decides whether one
   * bad entry in the SETUP sweep is fatal to the boot, and there is no sweep
   * here. This is a single imperative call, so it reports its own failure to its
   * own caller rather than leaving a registered issuer with no keys behind it.
   *
   * ⚠ A registered issuer is NOT part of the scheduled sweep — see
   * `AmphoraState.refreshAll`. Its keys are kept fresh by SCOPED lookups
   * (`find({ id, issuer })`) and by `external.refresh(issuer)`.
   */
  addIssuer(source: AmphoraExternalSettings): Promise<void> {
    return this.state.registerIssuer(source);
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

    // Drop the SOURCE(s) and the keys together — eviction is by issuer and takes
    // every key filed under it, so removing a single matching entry while a
    // second remained left the listing naming an issuer that held nothing.
    for (const removed of this.state.removeExternalEntries(issuer)) {
      this.state.evictIssuer(removed.issuer ?? removed.input.issuer ?? null);
    }
  }

  /**
   * The issuers amphora HOLDS — every registered source whose issuer has settled,
   * as a copy.
   *
   * A source registered by `openIdConfigurationUri` alone names no issuer until
   * that document is fetched, so a constructor-declared one is not an issuer yet
   * before `setup()` — nor after it, if the fetch failed and the source was not
   * `required`. It is omitted rather than listed with a `null`, and appears here
   * the moment it resolves. Omitting beats throwing: one unreachable peer must
   * not take out the whole listing, which is the same partial-failure tolerance
   * `refreshAll` is built on.
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
