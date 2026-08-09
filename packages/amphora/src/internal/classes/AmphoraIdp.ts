import { AmphoraError } from "../../errors/index.js";
import type { IAmphoraIdp } from "../../interfaces/index.js";
import type { AmphoraExternalConfig, AmphoraIdpSettings } from "../../types/index.js";
import { seedIdpConfig } from "../utils/seed-idp-config.js";
import { toExternalConfig } from "../utils/to-external-config.js";
import type { AmphoraState } from "./AmphoraState.js";

/**
 * The IDP facet — the ONE upstream identity provider, a distinguished singleton
 * external issuer over the shared {@link AmphoraState}. `set` registers or
 * REPLACES it (a swap evicts the previous idp's keys); its keys live external-
 * provenance in the unified vault. `config` throws when no idp is set.
 */
export class AmphoraIdp implements IAmphoraIdp {
  constructor(private readonly state: AmphoraState) {}

  /**
   * Register or REPLACE the upstream. It awaits the discovery / JWKS fetch and
   * THROWS when that fails — the same strictness `setup()` applies to a
   * construction-declared idp, reached through the same load. A caller pointing
   * the service at an upstream it cannot reach has misconfigured it, and hearing
   * so here beats a 500 later.
   */
  async set(source: AmphoraIdpSettings): Promise<void> {
    // One issuer, one scope — the idp cannot also be an external provider.
    this.state.assertIssuerScopeFree(source.issuer, "idp");

    const previous = this.state.idpEntry;
    const entry = seedIdpConfig(source);
    this.state.idpEntry = entry;

    // Singleton — the previous idp's keys are evicted on swap.
    if (previous) {
      this.state.evictIssuer(previous.issuer ?? previous.input.issuer ?? null);
    }

    await this.state.loadEntry(entry);
  }

  /**
   * The upstream's resolved config. It throws twice, because the caller asked for
   * ONE named provider and there is nothing sensible to hand back for either
   * failure: no idp registered at all, or one registered whose issuer amphora has
   * not settled. A `null` issuer here would be pinned as "verify against nothing".
   */
  config(): AmphoraExternalConfig {
    if (!this.state.idpEntry) {
      throw new AmphoraError("No identity provider is configured", {
        code: "idp_not_configured",
        title: "IDP Not Configured",
        details:
          "idp.config() was called but no upstream identity provider has been set. Configure one via the `idp` setting or `amphora.idp.set(...)` first.",
      });
    }

    const config = toExternalConfig(this.state.idpEntry);
    if (config) return config;

    throw new AmphoraError("Identity provider issuer is unresolved", {
      code: "idp_issuer_unresolved",
      data: {
        openIdConfigurationUri: this.state.idpEntry.input.openIdConfigurationUri,
      },
      title: "IDP Issuer Unresolved",
      details:
        "The upstream identity provider was registered by `openIdConfigurationUri` alone, so its issuer comes from the discovery document — and that document has not been fetched. An idp declared in the constructor is fetched by `amphora.setup()`, which throws if it cannot, so this means setup() has not run yet. Await setup() before reading config(), or declare `issuer` on the registration.",
    });
  }

  refresh(): Promise<void> {
    if (!this.state.idpEntry) return Promise.resolve();
    return this.state.loadEntry(this.state.idpEntry);
  }

  clear(): void {
    const previous = this.state.idpEntry;
    this.state.idpEntry = null;
    if (previous) {
      this.state.evictIssuer(previous.issuer ?? previous.input.issuer ?? null);
    }
  }
}
