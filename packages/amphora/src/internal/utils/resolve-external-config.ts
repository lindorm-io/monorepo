import type { Conduit } from "@lindorm/conduit";
import { isHttpUrl, isUri } from "@lindorm/is";
import type { OpenIdConfiguration } from "@lindorm/openid";
import { AmphoraError } from "../../errors/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { validateExternalSource } from "./validate-external-source.js";

const OIDCONF = "/.well-known/openid-configuration" as const;

/**
 * Resolve a declared issuer source: fetch/derive the discovery doc when one is
 * needed, and settle `issuer` / `jwksUri` / `openIdConfiguration`. Those three ARE
 * the return — resolution settles nothing else, so it offers nothing else.
 *
 * The narrow return is load-bearing, not tidiness. Resolution re-derives from
 * `input` alone, and `input` does not say which scope a source was registered in
 * (nothing in it does) nor whether the idp is required (`AmphoraIdpSettings` has no
 * `required` to declare). A wider return would therefore carry `scope:
 * "external"` and `required: false` — both WRONG for the idp — plus a zeroed
 * `keyCount` / `lastRefresh` / `lastAccess` that would clobber a live entry's
 * bookkeeping on every refresh. Returning only what is genuinely resolved means
 * those values cannot be spread, read or widened into existence.
 *
 * Every branch either settles a `string` issuer or throws, which is what makes the
 * PUBLIC `issuer: string` honest: resolution is the last moment an issuer can go
 * missing, so it is where the question is answered.
 *
 * Item-1 validation (issuer must be a URI; anything amphora FETCHES must be an
 * http(s) URL; a non-http issuer requires an explicit jwksUri) already ran at
 * REGISTRATION, so the input here is a resolvable source; asserting it again is
 * cheap and keeps the branches below free of the question. The branch guards
 * below are the same ones `validateExternalSource` uses, in the same order —
 * that pairing is what makes registration-time refusal equal to resolution-time
 * refusal, so a source can never be accepted here and rejected there.
 */
export const resolveExternalConfig = async (
  conduit: Conduit,
  input: AmphoraExternalSettings,
): Promise<Pick<AmphoraExternalConfig, "issuer" | "jwksUri" | "openIdConfiguration">> => {
  validateExternalSource(input);

  // 1. An explicit discovery URI — fetch it, derive issuer + jwksUri from the doc.
  if (isHttpUrl(input.openIdConfigurationUri)) {
    // The fetched document is UNVALIDATED, so it is read as a partial: a remote
    // provider can omit anything, whatever the specs mandate. Every member it
    // does send is carried through the spread verbatim.
    const { data } = await conduit.get<Partial<OpenIdConfiguration>>(
      input.openIdConfigurationUri,
    );

    const openIdConfiguration: Partial<OpenIdConfiguration> = {
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
      issuer,
      jwksUri: openIdConfiguration.jwksUri ?? input.jwksUri ?? null,
      openIdConfiguration,
    };
  }

  // 2. issuer + jwksUri given directly — no discovery. The issuer may be a URN
  //    (a private-use identifier scoping a set of keys), which is exactly why a
  //    URN reaches here only WITH a jwksUri. The issuer is an identity (`isUri`);
  //    the jwksUri is an address we fetch (`isHttpUrl`).
  if (isUri(input.issuer) && isHttpUrl(input.jwksUri)) {
    return {
      issuer: input.issuer,
      jwksUri: input.jwksUri,
      openIdConfiguration: input.openIdConfiguration ?? null,
    };
  }

  // 3. An http(s) URL issuer with no jwksUri — discover from
  //    `{issuer}/.well-known/...`. The location is DERIVED from the issuer, so the
  //    issuer has to be one: a URN cannot be resolved against at all, and any other
  //    scheme resolves to an address nothing can fetch. (Such an issuer with no
  //    jwksUri was rejected at registration; it cannot reach here.)
  if (isHttpUrl(input.issuer)) {
    const openIdConfigurationUri = new URL(OIDCONF, input.issuer).toString();

    const { data } =
      await conduit.get<Partial<OpenIdConfiguration>>(openIdConfigurationUri);

    const openIdConfiguration: Partial<OpenIdConfiguration> = {
      ...data,
      ...(input.openIdConfiguration ?? {}),
    };

    return {
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
      "An external issuer must provide an http(s) openIdConfigurationUri, an http(s) URL issuer to discover from, or a URI issuer together with an http(s) jwksUri.",
  });
};
