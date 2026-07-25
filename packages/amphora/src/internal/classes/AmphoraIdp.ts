import { AmphoraError } from "../../errors/index.js";
import type { IAmphoraIdp } from "../../interfaces/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { seedExternalConfig } from "../utils/seed-external-config.js";
import type { AmphoraState } from "./AmphoraState.js";

/**
 * The IDP facet — the ONE upstream identity provider, a distinguished singleton
 * external issuer over the shared {@link AmphoraState}. `set` registers or
 * REPLACES it (a swap evicts the previous idp's keys); its keys live external-
 * provenance in the unified vault. `config` throws when no idp is set.
 */
export class AmphoraIdp implements IAmphoraIdp {
  constructor(private readonly state: AmphoraState) {}

  async set(source: AmphoraExternalSettings): Promise<void> {
    // One issuer, one scope — the idp cannot also be an external provider.
    this.state.assertIssuerScopeFree(source.issuer, "idp");

    const previous = this.state.idpConfig;
    const config = seedExternalConfig(source);
    this.state.idpConfig = config;

    // Singleton — the previous idp's keys are evicted on swap.
    if (previous) {
      this.state.evictIssuer(previous.issuer ?? previous.input.issuer ?? null);
    }

    if (config.load) await this.state.loadEntry(config);
  }

  config(): AmphoraExternalConfig {
    if (!this.state.idpConfig) {
      throw new AmphoraError("No identity provider is configured", {
        code: "idp_not_configured",
        title: "IDP Not Configured",
        details:
          "idp.config() was called but no upstream identity provider has been set. Configure one via the `idp` setting or `amphora.idp.set(...)` first.",
      });
    }

    return { ...this.state.idpConfig };
  }

  refresh(): Promise<void> {
    if (!this.state.idpConfig) return Promise.resolve();
    return this.state.loadEntry(this.state.idpConfig);
  }

  clear(): void {
    const previous = this.state.idpConfig;
    this.state.idpConfig = null;
    if (previous) {
      this.state.evictIssuer(previous.issuer ?? previous.input.issuer ?? null);
    }
  }
}
