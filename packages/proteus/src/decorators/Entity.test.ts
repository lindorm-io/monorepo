import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Comment } from "./Comment.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Namespace } from "./Namespace.js";
import { PrimaryKey } from "./PrimaryKey.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity()
class EntityDefaultName {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "CustomEntityName" })
class EntityWithCustomName {
  @PrimaryKeyField()
  id!: string;
}

@Namespace("myapp")
@Entity({ name: "EntityWithOptions" })
class EntityWithOptions {
  @PrimaryKeyField()
  id!: string;
}

@Namespace("myns")
@Entity({ name: "EntityWithNamespace" })
class EntityWithNamespace {
  @PrimaryKey()
  @Field("uuid")
  id!: string;
}

describe("Entity", () => {
  test("should use class name as default entity name", () => {
    const metadata = getEntityMetadata(EntityDefaultName);
    expect(metadata.entity.name).toBe("EntityDefaultName");
    expect(metadata.entity.namespace).toBeNull();
  });

  test("should register custom entity name", () => {
    const metadata = getEntityMetadata(EntityWithCustomName);
    expect(metadata.entity.name).toBe("CustomEntityName");
  });

  test("should register all entity options", () => {
    expect(getEntityMetadata(EntityWithOptions)).toMatchSnapshot();
  });

  test("should register entity with namespace", () => {
    const metadata = getEntityMetadata(EntityWithNamespace);
    expect(metadata.entity.namespace).toBe("myns");
  });

  test("should register target constructor", () => {
    const metadata = getEntityMetadata(EntityDefaultName);
    expect(metadata.target).toBe(EntityDefaultName);
  });
});
