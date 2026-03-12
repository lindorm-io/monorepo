import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { UpdateDateField } from "./UpdateDateField";

@Entity({ name: "UpdateDateFieldDecorated" })
class UpdateDateFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @UpdateDateField()
  updatedAt!: Date;
}

describe("UpdateDateField", () => {
  test("should register updatedAt with timestamp type", () => {
    const meta = getEntityMetadata(UpdateDateFieldDecorated);
    const field = meta.fields.find((f) => f.decorator === "UpdateDate");
    expect(field).toBeDefined();
    expect(field!.type).toBe("timestamp");
    expect(field!.readonly).toBe(true);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(UpdateDateFieldDecorated)).toMatchSnapshot();
  });
});
