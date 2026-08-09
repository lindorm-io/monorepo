import type { AmphoraExternalConfig } from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";

/**
 * The internal → public boundary. Returns a COPY (so a caller cannot mutate
 * amphora's state through the value it was handed), or `null` when the entry has
 * not settled an issuer yet.
 *
 * What an unsettled entry MEANS is the caller's to decide, because the two callers
 * genuinely differ: `idp.config()` was asked for one specific provider and throws,
 * while `external.issuers()` lists what amphora holds and simply omits it — a
 * single unreachable peer must not take out the whole listing.
 *
 * The copy names every field rather than spreading the entry: {@link ExternalEntry}
 * carries bookkeeping the public config does not (`scope`), and a spread would ship
 * each such field to consumers untyped and unnoticed.
 */
export const toExternalConfig = (entry: ExternalEntry): AmphoraExternalConfig | null =>
  entry.issuer === null
    ? null
    : {
        input: entry.input,
        required: entry.required,
        issuer: entry.issuer,
        jwksUri: entry.jwksUri,
        openIdConfiguration: entry.openIdConfiguration,
        keyCount: entry.keyCount,
        lastRefresh: entry.lastRefresh,
        lastAccess: entry.lastAccess,
      };
