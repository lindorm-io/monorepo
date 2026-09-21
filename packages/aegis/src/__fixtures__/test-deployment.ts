import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Aegis } from "../classes/Aegis.js";
import { TEST_EC_KEY_SIG } from "./keys.js";

/** The deployment identity every fixture-driven suite shares. */
export const ISSUER = "https://test.lindorm.io/";
export const RESOURCE = "https://rs.lindorm.io/";
export const CLIENT = "client-1";

/** The instant every fixture-driven suite runs at, ISO-8601. */
export const DEFAULT_CLOCK = "2024-01-01T08:00:00.000Z";

/** {@link DEFAULT_CLOCK} in epoch seconds — the unit a temporal claim carries. */
export const NOW = new Date(DEFAULT_CLOCK).getTime() / 1000;

/** The deployment under test: an `Aegis` and the vault it resolves keys from. */
export type TestDeployment = {
  aegis: Aegis;
  amphora: IAmphora;
};

/**
 * An Amphora scoped to the test issuer, a mock logger, and the ES512 signing key
 * every run starts from. Further vault residents are added per run.
 */
export const createTestDeployment = async (): Promise<TestDeployment> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
  const aegis = new Aegis({ amphora, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  return { aegis, amphora };
};
