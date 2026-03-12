import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Index } from "./Index_";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "IndexFieldLevel" })
class IndexFieldLevel {
  @PrimaryKeyField()
  id!: string;

  @Index()
  @Field("string")
  name!: string;
}

@Entity({ name: "IndexFieldLevelDesc" })
class IndexFieldLevelDesc {
  @PrimaryKeyField()
  id!: string;

  @Index("desc", { name: "idx_email_desc" })
  @Field("string")
  email!: string;
}

@Entity({ name: "IndexFieldLevelOptions" })
class IndexFieldLevelOptions {
  @PrimaryKeyField()
  id!: string;

  @Index({ unique: true, name: "idx_unique_slug" })
  @Field("string")
  slug!: string;
}

@Entity({ name: "IndexClassLevelArray" })
@Index<typeof IndexClassLevelArray>(["email", "name"])
class IndexClassLevelArray {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

@Entity({ name: "IndexClassLevelDict" })
@Index<typeof IndexClassLevelDict>({ email: "asc", name: "desc" })
class IndexClassLevelDict {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

describe("Index", () => {
  test("should register field-level index with default direction", () => {
    const meta = getEntityMetadata(IndexFieldLevel);
    const idx = meta.indexes.find((i) => i.keys.some((k) => k.key === "name"));
    expect(idx).toBeDefined();
    expect(idx!.keys[0].direction).toBe("asc");
  });

  test("should register field-level index with custom direction and name", () => {
    expect(getEntityMetadata(IndexFieldLevelDesc)).toMatchSnapshot();
  });

  test("should register field-level unique index with options", () => {
    const meta = getEntityMetadata(IndexFieldLevelOptions);
    const idx = meta.indexes.find((i) => i.keys.some((k) => k.key === "slug"));
    expect(idx).toBeDefined();
    expect(idx!.unique).toBe(true);
    expect(idx!.name).toBe("idx_unique_slug");
  });

  test("should register class-level array index", () => {
    expect(getEntityMetadata(IndexClassLevelArray)).toMatchSnapshot();
  });

  test("should register class-level dict index with per-key directions", () => {
    const meta = getEntityMetadata(IndexClassLevelDict);
    const idx = meta.indexes.find((i) => i.keys.length === 2 && i.name === null);
    expect(idx).toBeDefined();
    const emailKey = idx!.keys.find((k) => k.key === "email");
    const nameKey = idx!.keys.find((k) => k.key === "name");
    expect(emailKey!.direction).toBe("asc");
    expect(nameKey!.direction).toBe("desc");
  });
});
