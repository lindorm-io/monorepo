import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { CreateDateField } from "./CreateDateField.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { ReadOnly } from "./ReadOnly.js";
import { UpdateDateField } from "./UpdateDateField.js";
import { VersionField } from "./VersionField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "ReadOnlyDecorated" })
class ReadOnlyDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @ReadOnly()
  @Field("string")
  createdBy!: string;

  @ReadOnly("update")
  @Field("string")
  updateOnly!: string;

  @ReadOnly("upsert")
  @Field("string")
  upsertOnly!: string;
}

@Entity({ name: "ReadOnlyNotDecorated" })
class ReadOnlyNotDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

describe("ReadOnly", () => {
  test("should stage both operations for a bare @ReadOnly()", () => {
    const meta = getEntityMetadata(ReadOnlyDecorated);
    const field = meta.fields.find((f) => f.key === "createdBy")!;
    expect(field.readonly).toEqual(["update", "upsert"]);
  });

  test("should stage only 'update' for @ReadOnly('update')", () => {
    const meta = getEntityMetadata(ReadOnlyDecorated);
    const field = meta.fields.find((f) => f.key === "updateOnly")!;
    expect(field.readonly).toEqual(["update"]);
  });

  test("should stage only 'upsert' for @ReadOnly('upsert')", () => {
    const meta = getEntityMetadata(ReadOnlyDecorated);
    const field = meta.fields.find((f) => f.key === "upsertOnly")!;
    expect(field.readonly).toEqual(["upsert"]);
  });

  test("should default readonly to an empty array when not decorated", () => {
    const meta = getEntityMetadata(ReadOnlyNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.readonly).toEqual([]);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(ReadOnlyDecorated)).toMatchSnapshot();
  });

  describe("operation-scoped @ReadOnly on framework columns", () => {
    test("should reject @ReadOnly('upsert') on the primary key", () => {
      expect(() => {
        @Entity({ name: "RoBadPk" })
        class RoBadPk {
          @ReadOnly("upsert")
          @PrimaryKeyField()
          @Generated("uuid")
          id!: string;
        }
        getEntityMetadata(RoBadPk);
      }).toThrow(/cannot be applied to primary key/);
    });

    test("should reject @ReadOnly('upsert') on a @VersionField", () => {
      expect(() => {
        @Entity({ name: "RoBadVersion" })
        class RoBadVersion {
          @PrimaryKeyField() @Generated("uuid") id!: string;

          @ReadOnly("upsert")
          @VersionField()
          version!: number;
        }
        getEntityMetadata(RoBadVersion);
      }).toThrow(/@VersionField/);
    });

    test("should reject @ReadOnly('update') on a @CreateDateField", () => {
      expect(() => {
        @Entity({ name: "RoBadCreate" })
        class RoBadCreate {
          @PrimaryKeyField() @Generated("uuid") id!: string;

          @ReadOnly("update")
          @CreateDateField()
          createdAt!: Date;
        }
        getEntityMetadata(RoBadCreate);
      }).toThrow(/@CreateDateField/);
    });

    test("should reject @ReadOnly('upsert') on an @UpdateDateField", () => {
      expect(() => {
        @Entity({ name: "RoBadUpdate" })
        class RoBadUpdate {
          @PrimaryKeyField() @Generated("uuid") id!: string;

          @ReadOnly("upsert")
          @UpdateDateField()
          updatedAt!: Date;
        }
        getEntityMetadata(RoBadUpdate);
      }).toThrow(/@UpdateDateField/);
    });

    test("should allow a bare @ReadOnly() on a framework column", () => {
      expect(() => {
        @Entity({ name: "RoOkCreate" })
        class RoOkCreate {
          @PrimaryKeyField() @Generated("uuid") id!: string;

          @ReadOnly()
          @CreateDateField()
          createdAt!: Date;
        }
        getEntityMetadata(RoOkCreate);
      }).not.toThrow();
    });
  });
});
