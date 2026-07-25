import type { Conduit } from "@lindorm/conduit";
import { isArray, isString } from "@lindorm/is";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { OpenIdJwksResponse } from "@lindorm/types";
import { AmphoraError } from "../../errors/index.js";
import type { AmphoraExternalConfig } from "../../types/index.js";

type FetchExternalJwksOptions = {
  maxExternalKeys: number;
  logger: ILogger;
};

/**
 * Fetch and vet one issuer's JWKS. The SECURITY-CRITICAL core: every fetched key
 * is checked for issuer match, trust-anchor certificate validity, and expiry; a
 * single unparseable key is isolated rather than taking out the issuer's whole
 * set; the key count is truncated to `maxExternalKeys`. Trust config is read from
 * the config's declared `input` (trustAnchors / trustMode).
 */
export const fetchExternalJwks = async (
  conduit: Conduit,
  config: AmphoraExternalConfig,
  options: FetchExternalJwksOptions,
): Promise<Array<IKryptos>> => {
  const { logger, maxExternalKeys } = options;

  logger.silly("Finding External JWKS", { issuer: config.issuer });

  if (!config.jwksUri) {
    throw new AmphoraError("External config has no jwksUri to fetch", {
      code: "external_jwks_uri_missing",
      data: { issuer: config.issuer },
      title: "External JWKS URI Missing",
      details: `The external issuer "${config.issuer ?? "unknown"}" resolved without a jwksUri, so its keys cannot be fetched. Check the discovery document or supply an explicit jwksUri.`,
    });
  }

  const {
    data: { keys },
  } = await conduit.get<OpenIdJwksResponse>(config.jwksUri);

  if (keys.length === 0) {
    logger.warn("External JWKS response contains no keys", {
      issuer: config.issuer,
    });
    return [];
  }

  if (keys.length > maxExternalKeys) {
    logger.warn("External JWKS response exceeds key limit, truncating", {
      issuer: config.issuer,
      count: keys.length,
      limit: maxExternalKeys,
    });
    keys.length = maxExternalKeys;
  }

  const result: Array<IKryptos> = [];
  let rejectedCount = 0;
  let expiredCount = 0;
  let rejectedByTrust = 0;
  let unusableCount = 0;

  const trustAnchors = config.input.trustAnchors;
  const trustRequired =
    (isString(trustAnchors) && trustAnchors.length > 0) ||
    (isArray(trustAnchors) && trustAnchors.length > 0);
  const trustMode = config.input.trustMode ?? "strict";

  for (const jwk of keys) {
    if (jwk.iss && jwk.iss !== config.issuer) {
      logger.warn("External JWK issuer mismatch, skipping key", {
        expected: config.issuer,
        actual: jwk.iss,
        kid: jwk.kid,
      });
      rejectedCount++;
      continue;
    }

    // One unusable key must not take out the issuer's entire key set. A JWK that
    // kryptos cannot parse (commonly a missing "alg", which RFC 7517 makes optional
    // but kryptos requires) is skipped like any other rejected key.
    let kryptos: IKryptos;

    try {
      kryptos = KryptosKit.from.jwk(
        {
          ...jwk,
          iss: config.issuer ?? undefined,
          jku: jwk.jku ?? config.jwksUri,
        },
        // Not ours — this key came off a remote JWKS. It is also `from.jwk`'s
        // default, but a provenance claim is worth stating outright.
        false,
      );
    } catch (error) {
      logger.warn("External JWK rejected: key could not be parsed", {
        issuer: config.issuer,
        kid: jwk.kid,
        error: error instanceof Error ? error.message : String(error),
      });
      unusableCount++;
      continue;
    }

    if (kryptos.isExpired) {
      expiredCount++;
      continue;
    }

    if (trustRequired) {
      if (!kryptos.hasCertificate) {
        if (trustMode === "strict") {
          logger.warn(
            "External JWK rejected: trust validation required but key has no certificate chain",
            { issuer: config.issuer, kid: jwk.kid },
          );
          rejectedByTrust++;
          continue;
        }

        logger.debug("External JWK accepted without cert validation (lax trust mode)", {
          issuer: config.issuer,
          kid: jwk.kid,
        });
      } else {
        try {
          kryptos.verifyCertificate({ trustAnchors: trustAnchors });
        } catch (error) {
          logger.warn(
            "External JWK rejected: certificate chain failed trust validation",
            {
              issuer: config.issuer,
              kid: jwk.kid,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          rejectedByTrust++;
          continue;
        }
      }
    }

    logger.silly("Adding Kryptos from external source", { kryptos });
    result.push(kryptos);
  }

  if (rejectedCount > 0 || expiredCount > 0 || rejectedByTrust > 0 || unusableCount > 0) {
    logger.silly("External JWKS key summary", {
      issuer: config.issuer,
      total: keys.length,
      valid: result.length,
      rejected: rejectedCount,
      expired: expiredCount,
      rejectedByTrust,
      unusable: unusableCount,
    });
  }

  if (result.length === 0 && keys.length > 0) {
    const data = {
      issuer: config.issuer,
      total: keys.length,
      rejected: rejectedCount,
      expired: expiredCount,
      rejectedByTrust,
      unusable: unusableCount,
    };

    if (rejectedByTrust === keys.length) {
      throw new AmphoraError(
        "All external JWK keys rejected due to trust anchor validation",
        {
          code: "external_jwks_all_rejected_by_trust",
          data,
          title: "External JWKS All Rejected By Trust",
          details: `Every key from issuer "${config.issuer}" failed trust anchor validation. Verify the configured trustAnchors and the keys' certificate chains.`,
        },
      );
    }

    if (rejectedCount === keys.length) {
      throw new AmphoraError("All external JWK keys rejected due to issuer mismatch", {
        code: "external_jwks_issuer_mismatch",
        data,
        title: "External JWKS Issuer Mismatch",
        details: `Every key returned for issuer "${config.issuer}" declared a different "iss" value. Ensure the configured issuer matches the keys served at the JWKS endpoint.`,
      });
    }

    if (unusableCount === keys.length) {
      throw new AmphoraError("All external JWK keys could not be parsed", {
        code: "external_jwks_all_unusable",
        data,
        title: "External JWKS All Unusable",
        details: `Every key returned for issuer "${config.issuer}" could not be parsed. The endpoint is serving keys this library cannot read — most commonly a JWK without an "alg" (optional in RFC 7517, required here). Inspect the JWKS document and ensure each key declares "alg" and "kid".`,
      });
    }

    if (expiredCount + rejectedCount + rejectedByTrust + unusableCount === keys.length) {
      throw new AmphoraError(
        "No valid external JWK keys (expired, rejected, untrusted, or unparseable)",
        {
          code: "external_jwks_no_valid_keys",
          data,
          title: "External JWKS No Valid Keys",
          details: `All keys from issuer "${config.issuer}" were unusable (expired, issuer-mismatched, untrusted, or unparseable). Check that the endpoint serves current, trusted, parseable keys for this issuer.`,
        },
      );
    }
  }

  return result;
};
