import type { Conduit } from "@lindorm/conduit";
import { isUri, isUrlLike, isUrn } from "@lindorm/is";
import type { Configuration } from "@lindorm/openid";
import { AmphoraError } from "../../errors/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { seedExternalConfig } from "./seed-external-config.js";

const OIDCONF = "/.well-known/openid-configuration" as const;

/**
 * Resolve a declared issuer source into an enriched {@link AmphoraExternalConfig}:
 * fetch/derive the discovery doc when one is needed, and settle `issuer` / `jwksUri`
 * / `openIdConfiguration`. `keyCount` and `lastRefresh` are left for the JWKS fetch
 * to fill — this only resolves config.
 *
 * Item-1 validation (issuer must be a URI; a URN issuer requires an explicit jwksUri)
 * already ran at REGISTRATION via `seedExternalConfig` → `validateExternalSource`, so
 * the input here is a resolvable source. Discovery from a URL issuer is gated on
 * `isUrlLike(issuer) && !isUrn(issuer)`.
 */
export const resolveExternalConfig = async (
  conduit: Conduit,
  input: AmphoraExternalSettings,
): Promise<AmphoraExternalConfig> => {
  const base = seedExternalConfig(input);

  // 1. An explicit discovery URI — fetch it, derive issuer + jwksUri from the doc.
  if (isUrlLike(input.openIdConfigurationUri)) {
    // The fetched document is UNVALIDATED, so it is read as a partial: a remote
    // provider can omit anything, whatever the specs mandate. Every member it
    // does send is carried through the spread verbatim.
    const { data } = await conduit.get<Partial<Configuration>>(
      input.openIdConfigurationUri,
    );

    const openIdConfiguration: Partial<Configuration> = {
      ...data,
      ...(input.openIdConfiguration ?? {}),
    };

    // A RESOLVED external config MUST carry an issuer — OIDC Discovery mandates it,
    // and keys are scoped / verified (`jwk.iss`) / evicted by it. A doc that omits
    // `issuer` with no configured `input.issuer` is malformed and unusable.
    const issuer = openIdConfiguration.issuer ?? input.issuer ?? null;
    if (issuer === null) {
      throw new AmphoraError("External issuer could not be resolved", {
        code: "external_issuer_unresolved",
        data: { openIdConfigurationUri: input.openIdConfigurationUri },
        title: "External Issuer Unresolved",
        details:
          "The discovery document did not provide an issuer and none was configured. An external issuer must resolve to a URI (a URL or a URN).",
      });
    }

    return {
      ...base,
      issuer,
      jwksUri: openIdConfiguration.jwksUri ?? input.jwksUri ?? null,
      openIdConfiguration,
    };
  }

  // 2. issuer + jwksUri given directly — no discovery. The issuer may be a URN
  //    (a private-use identifier scoping a set of keys), which is exactly why a
  //    URN reaches here only WITH a jwksUri.
  if (isUri(input.issuer) && isUrlLike(input.jwksUri)) {
    return {
      ...base,
      issuer: input.issuer,
      jwksUri: input.jwksUri,
      openIdConfiguration: input.openIdConfiguration ?? null,
    };
  }

  // 3. A URL issuer with no jwksUri — discover from `{issuer}/.well-known/...`. (A URN
  //    issuer with no jwksUri was rejected at registration; it cannot reach here.)
  if (isUrlLike(input.issuer) && !isUrn(input.issuer)) {
    const openIdConfigurationUri = new URL(OIDCONF, input.issuer).toString();

    const { data } = await conduit.get<Partial<Configuration>>(openIdConfigurationUri);

    const openIdConfiguration: Partial<Configuration> = {
      ...data,
      ...(input.openIdConfiguration ?? {}),
    };

    return {
      ...base,
      issuer: openIdConfiguration.issuer ?? input.issuer,
      jwksUri: openIdConfiguration.jwksUri ?? input.jwksUri ?? null,
      openIdConfiguration,
    };
  }

  // 5. Nothing usable — no discovery URI, no issuer, no jwksUri.
  throw new AmphoraError("Invalid external issuer options", {
    code: "invalid_issuer_options",
    data: {
      issuer: input.issuer,
      jwksUri: input.jwksUri,
      openIdConfigurationUri: input.openIdConfigurationUri,
    },
    title: "Invalid Issuer Options",
    debug: {
      openIdConfiguration: input.openIdConfiguration,
      trustAnchors: input.trustAnchors,
    },
    details:
      "An external issuer must provide a valid openIdConfigurationUri, a URL issuer to discover from, or a URI issuer together with a valid jwksUri.",
  });
};
