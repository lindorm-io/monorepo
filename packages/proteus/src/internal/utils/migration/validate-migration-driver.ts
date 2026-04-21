import type { MigrationInterfaceShape } from "./resolve-pending.js";
import { ProteusError } from "../../../errors/ProteusError.js";

/**
 * Validates that a migration's `driver` field (if set) matches the current
 * driver type. Throws if there is a mismatch to prevent running migrations
 * generated for a different database engine.
 */
export const validateMigrationDriver = (
  migration: MigrationInterfaceShape,
  migrationName: string,
  currentDriver: string,
): void => {
  if (migration.driver && migration.driver !== currentDriver) {
    throw new ProteusError(
      `Migration "${migrationName}" was generated for the "${migration.driver}" driver ` +
        `but is being run against "${currentDriver}". Aborting to prevent data corruption.`,
      {
        debug: {
          migrationName,
          migrationDriver: migration.driver,
          currentDriver,
        },
      },
    );
  }
};
