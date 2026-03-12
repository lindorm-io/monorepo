import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { VersionStartDateField } from "./VersionStartDateField";

@Entity({ name: "VersionStartDateFieldDecorated" })
class VersionStartDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @VersionStartDateField()
  startAt!: Date;
}

describe("VersionStartDateField", () => {
  test("should register startAt with timestamp type", () => {
    const meta = getEntityMetadata(VersionStartDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "VersionStartDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.readonly).toBe(true);
    expect(field!.nullable).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(VersionStartDateFieldDecorated)).toMatchSnapshot();
  });
});
