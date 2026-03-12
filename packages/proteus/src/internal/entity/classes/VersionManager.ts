import { isNumber } from "@lindorm/is";
import { IEntity } from "../../../interfaces";
import { EntityManagerError } from "../errors/EntityManagerError";
import type { EntityMetadata, MetaField } from "../types/metadata";

export class VersionManager<E extends IEntity = IEntity> {
  public static readonly INITIAL_VERSION = 0;
  public static readonly FIRST_PERSISTED_VERSION = 1;

  private readonly versionField: MetaField | undefined;

  public constructor(metadata: EntityMetadata) {
    this.versionField = metadata.fields.find((f) => f.decorator === "Version");
  }

  public isVersioned(): boolean {
    return this.versionField !== undefined;
  }

  public getVersion(entity: E): number {
    if (!this.versionField) {
      return VersionManager.INITIAL_VERSION;
    }
    const version = (entity as any)[this.versionField.key];
    return isNumber(version) ? version : VersionManager.INITIAL_VERSION;
  }

  public setVersion(entity: E, version: number): void {
    if (!this.versionField) {
      return;
    }
    if (!Number.isInteger(version) || version < 0) {
      throw new EntityManagerError(
        `Invalid version number: ${version}. Version must be non-negative integer.`,
        { debug: { version } },
      );
    }
    (entity as any)[this.versionField.key] = version;
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
