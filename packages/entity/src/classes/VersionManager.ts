import { EntityKitError } from "../errors";
import { IEntity } from "../interfaces";
import { EntityMetadata, MetaColumn } from "../types";

export class VersionManager<E extends IEntity = IEntity> {
  public static readonly INITIAL_VERSION = 0;
  public static readonly FIRST_PERSISTED_VERSION = 1;

  private readonly versionColumn: MetaColumn | undefined;

  public constructor(metadata: EntityMetadata) {
    this.versionColumn = metadata.columns.find((c) => c.decorator === "VersionColumn");
  }

  public isVersioned(): boolean {
    return this.versionColumn !== undefined;
  }

  public getVersion(entity: E): number {
    if (!this.versionColumn) {
      return VersionManager.INITIAL_VERSION;
    }

    const version = (entity as any)[this.versionColumn.key];
    return typeof version === "number" ? version : VersionManager.INITIAL_VERSION;
  }

  public setVersion(entity: E, version: number): void {
    if (!this.versionColumn) {
      return;
    }

    if (!Number.isInteger(version) || version < 0) {
      throw new EntityKitError(
        `Invalid version number: ${version}. Version must be non-negative integer.`,
        { debug: { version } },
      );
    }

    (entity as any)[this.versionColumn.key] = version;
  }

  public incrementVersion(entity: E): number {
    const currentVersion = this.getVersion(entity);
    const newVersion = currentVersion + 1;
    this.setVersion(entity, newVersion);
    return newVersion;
  }

  public prepareForInsert(entity: E): void {
    this.setVersion(entity, VersionManager.FIRST_PERSISTED_VERSION);
  }

  public prepareForUpdate(entity: E): void {
    this.incrementVersion(entity);
  }
}
