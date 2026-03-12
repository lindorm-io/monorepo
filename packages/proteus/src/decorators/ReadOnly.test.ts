import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { ReadOnly } from "./ReadOnly";

@Entity({ name: "ReadOnlyDecorated" })
class ReadOnlyDecorated {
  @PrimaryKeyField()
  id!: string;

  @ReadOnly()
  @Field("string")
  createdBy!: string;
}

@Entity({ name: "ReadOnlyNotDecorated" })
class ReadOnlyNotDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("ReadOnly", () => {
  test("should set readonly to true on the field", () => {
    const meta = getEntityMetadata(ReadOnlyDecorated);
    const field = meta.fields.find((f) => f.key === "createdBy")!;
    expect(field.readonly).toBe(true);
  });

  test("should default readonly to false when not decorated", () => {
    const meta = getEntityMetadata(ReadOnlyNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.readonly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(ReadOnlyDecorated)).toMatchSnapshot();
  });
});
