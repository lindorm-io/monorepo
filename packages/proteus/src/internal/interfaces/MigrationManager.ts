import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { NamespaceOptions } from "#internal/types/types";
import type { MigrationApplyResult, MigrationRecord } from "#internal/types/migration";
import type {
  ResolvedMigration,
  GhostMigration,
} from "#internal/utils/migration/resolve-pending";

export type MigrationStatusResult = {
  resolved: Array<ResolvedMigration>;
  ghosts: Array<GhostMigration>;
};

export type GenerateMigrationResult = {
  filepath: string | null;
  operationCount: number;
  isEmpty: boolean;
};

export type GenerateBaselineResult = {
  filepath: string;
  operationCount: number;
  markedAsApplied: boolean;
};

export interface IMigrationManager {
  // Core lifecycle — all drivers
  status(): Promise<MigrationStatusResult>;
  apply(): Promise<MigrationApplyResult>;
  rollback(count?: number): Promise<MigrationApplyResult>;
  getRecords(): Promise<Array<MigrationRecord>>;

  // Resolution — all drivers
  resolveApplied(name: string, directory: string): Promise<void>;
  resolveRolledBack(name: string): Promise<void>;

  // Generation — SQL drivers only (optional)
  generateMigration?(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date; writeFile?: boolean },
  ): Promise<GenerateMigrationResult>;

  generateBaseline?(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date },
  ): Promise<GenerateBaselineResult>;
}
