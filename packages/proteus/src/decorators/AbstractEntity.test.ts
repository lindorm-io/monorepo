import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { buildPrimaryMetadata } from "../internal/entity/metadata/build-primary";
import { AbstractEntity } from "./AbstractEntity";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { CreateDateField } from "./CreateDateField";
import { UpdateDateField } from "./UpdateDateField";
import { BeforeInsert } from "./BeforeInsert";
import { describe, expect, test, vi } from "vitest";

const setTimestamps = vi.fn();

// Abstract base class — no @Entity(), just fields and hooks
@AbstractEntity()
@BeforeInsert(setTimestamps)
class Auditable {
  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

// Concrete entity inheriting from abstract base
@Entity({ name: "ConcreteUser" })
class ConcreteUser extends Auditable {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

// Another concrete entity inheriting from the same abstract base
@Entity({ name: "ConcretePost" })
class ConcretePost extends Auditable {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;
}

// Invalid: both @AbstractEntity and @Entity on same class
@AbstractEntity()
@Entity({ name: "InvalidDualDecorator" })
class InvalidDualDecorator {
  @PrimaryKeyField()
  id!: string;
}

describe("AbstractEntity", () => {
  test("should throw when building metadata for abstract entity directly", () => {
    expect(() => buildPrimaryMetadata(Auditable)).toThrow(
      "Cannot build metadata for abstract entity",
    );
  });

  test("should throw when @AbstractEntity and @Entity on same class", () => {
    expect(() => getEntityMetadata(InvalidDualDecorator)).toThrow(
      "@AbstractEntity and @Entity cannot be used on the same class",
    );
  });

  test("should inherit fields from abstract base into concrete entity", () => {
    const metadata = getEntityMetadata(ConcreteUser);
    const fieldKeys = metadata.fields.map((f) => f.key);

    expect(fieldKeys).toContain("id");
    expect(fieldKeys).toContain("name");
    expect(fieldKeys).toContain("createdAt");
    expect(fieldKeys).toContain("updatedAt");
  });

  test("should inherit hooks from abstract base into concrete entity", () => {
    const metadata = getEntityMetadata(ConcreteUser);

    expect(metadata.hooks.length).toBeGreaterThanOrEqual(1);
    expect(metadata.hooks.some((h) => h.decorator === "BeforeInsert")).toBe(true);
  });

  test("should produce full metadata snapshot for concrete entity with abstract base", () => {
    const metadata = getEntityMetadata(ConcreteUser);
    expect(metadata.fields).toMatchSnapshot();
    expect(metadata.hooks).toMatchSnapshot();
  });

  test("should allow multiple concrete entities to inherit from the same abstract base", () => {
    const userMeta = getEntityMetadata(ConcreteUser);
    const postMeta = getEntityMetadata(ConcretePost);

    // Both should have the inherited fields
    const userFieldKeys = userMeta.fields.map((f) => f.key);
    const postFieldKeys = postMeta.fields.map((f) => f.key);

    expect(userFieldKeys).toContain("createdAt");
    expect(userFieldKeys).toContain("updatedAt");
    expect(postFieldKeys).toContain("createdAt");
    expect(postFieldKeys).toContain("updatedAt");

    // But each has its own unique fields
    expect(userFieldKeys).toContain("name");
    expect(userFieldKeys).not.toContain("title");
    expect(postFieldKeys).toContain("title");
    expect(postFieldKeys).not.toContain("name");
  });

  test("should have correct entity name on concrete subclass", () => {
    const metadata = getEntityMetadata(ConcreteUser);
    expect(metadata.entity.name).toBe("ConcreteUser");
  });

  test("should stage __abstract on metadata", () => {
    const meta = (Auditable as any)[Symbol.metadata];
    expect(meta.__abstract).toBe(true);
  });

  test("concrete entity should not have __abstract", () => {
    const meta = (ConcreteUser as any)[Symbol.metadata];
    // __abstract is only on the prototype chain, not on the own metadata
    expect(Object.hasOwn(meta, "__abstract")).toBe(false);
  });
});
