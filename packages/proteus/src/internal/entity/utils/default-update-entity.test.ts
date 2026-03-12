import { defaultUpdateEntity } from "./default-update-entity";
import { CreateDateField } from "../../../decorators/CreateDateField";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { UpdateDateField } from "../../../decorators/UpdateDateField";
import { VersionField } from "../../../decorators/VersionField";

@Entity({ name: "UpdateEntityVersioned" })
class UpdateEntityVersioned {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

@Entity({ name: "UpdateEntityNoVersion" })
class UpdateEntityNoVersion {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

describe("defaultUpdateEntity", () => {
  test("should increment version field", () => {
    const now = new Date("2024-01-01");
    const entity = {
      id: "abc",
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: "Test",
    } as UpdateEntityVersioned;

    defaultUpdateEntity(UpdateEntityVersioned, entity);

    expect(entity.version).toBe(2);
  });

  test("should update the updatedAt field", () => {
    const before = new Date("2024-01-01");
    const entity = {
      id: "abc",
      version: 1,
      createdAt: before,
      updatedAt: before,
      name: "Test",
    } as UpdateEntityVersioned;

    defaultUpdateEntity(UpdateEntityVersioned, entity);

    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(entity.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test("should return the entity object", () => {
    const entity = {
      id: "abc",
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
    } as UpdateEntityVersioned;

    const result = defaultUpdateEntity(UpdateEntityVersioned, entity);
    expect(result).toBe(entity);
  });

  test("should update updatedAt even without version field", () => {
    const before = new Date("2024-01-01");
    const entity = {
      id: "abc",
      createdAt: before,
      updatedAt: before,
      name: "Test",
    } as UpdateEntityNoVersion;

    defaultUpdateEntity(UpdateEntityNoVersion, entity);

    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(entity.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
