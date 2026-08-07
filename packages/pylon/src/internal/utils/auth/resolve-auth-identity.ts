import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type {
  PylonAuthClientConfig,
  PylonAuthDriverContext,
} from "../../../types/index.js";

/**
 * The identity the provider knows this pylon by, and the only two inputs the
 * driver-response caches key on besides the token itself.
 *
 * ⚠ The issuer comes from `endpoints()`, not from settings: a tenant-scoped
 * provider templates it in its metadata and the concrete value is only known at
 * runtime. The client secret never leaves the driver.
 */
export const resolveAuthIdentity = async (
  driver: IPylonAuthDriver,
  context: PylonAuthDriverContext,
): Promise<PylonAuthClientConfig> => {
  const endpoints = await driver.endpoints(context);

  return { issuer: endpoints.issuer, clientId: driver.clientId };
};
