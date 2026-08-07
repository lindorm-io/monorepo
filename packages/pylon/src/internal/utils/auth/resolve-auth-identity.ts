import { ServerError } from "@lindorm/errors";
import { isEmpty, isString } from "@lindorm/is";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type {
  PylonAuthClientConfig,
  PylonAuthDriverContext,
} from "../../../types/index.js";

/**
 * The identity the provider knows this pylon by, and the only two inputs the
 * driver-response caches key on besides the token itself.
 *
 * ⚠ The issuer comes from `endpoints()`, not from settings: it is amphora's
 * resolved issuer for the scope the driver pinned, and a tenant-scoped provider
 * only settles it at runtime. The client secret never leaves the driver.
 *
 * ⚠ A driver with no `clientId` is a VERIFY-ONLY driver, and a verify-only
 * driver has no `introspect` and no `userinfo` — so it never reaches a
 * driver-response cache, and this is unreachable for it. It THROWS rather than
 * substituting an empty client id: an empty string would silently key every
 * such pylon's cache entries together, which is precisely the cross-tenant leak
 * `buildAuthCacheKey` exists to prevent. Both cache paths already treat a
 * failure here as "no identity to key on" and fall through to an uncached call,
 * so the throw degrades rather than breaks.
 */
export const resolveAuthIdentity = (
  driver: IPylonAuthDriver,
  context: PylonAuthDriverContext,
): PylonAuthClientConfig => {
  const { clientId } = driver;

  // ⚠ `isEmpty` as well as `isString`: `""` is a client id that is simply
  // WRONG, not an absent one, and it would key every pylon that carries it into
  // one shared cache entry.
  if (isString(clientId) && !isEmpty(clientId)) {
    return { issuer: driver.endpoints(context).issuer, clientId };
  }

  throw new ServerError("Auth driver exposes no client id", {
    code: "driver_has_no_client_id",
    title: "Auth Driver Has No Client Id",
    type: "urn:lindorm:pylon:error:driver_has_no_client_id",
    details:
      "The configured auth driver declares no usable `clientId`, which is how a verify-only driver states that it is nobody's OAuth client. There is no identity for `ctx.auth.config()` to report or for a driver-response cache to key on.",
  });
};
