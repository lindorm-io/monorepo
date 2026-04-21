import { getSaveStrategy } from "./get-save-strategy.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKey } from "../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "GetSaveStrategyVersioned" })
class GetSaveStrategyVersioned {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "GetSaveStrategyGenerated" })
class GetSaveStrategyGenerated {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "GetSaveStrategyNoMarkers" })
class GetSaveStrategyNoMarkers {
  @PrimaryKey()
  @Field("uuid")
  id!: string;

  @Field("string")
  name!: string;
}

describe("getSaveStrategy", () => {
  test("should return 'insert' when version is 0", () => {
    const entity = { id: "abc", version: 0, name: "test" } as GetSaveStrategyVersioned;
    expect(getSaveStrategy(GetSaveStrategyVersioned, entity)).toBe("insert");
  });

  test("should return 'update' when version is greater than 0", () => {
    const entity = { id: "abc", version: 3, name: "test" } as GetSaveStrategyVersioned;
    expect(getSaveStrategy(GetSaveStrategyVersioned, entity)).toBe("update");
  });

  test("should return 'insert' when generated field is missing", () => {
    const entity = { id: undefined, name: "test" } as any;
    expect(getSaveStrategy(GetSaveStrategyGenerated, entity)).toBe("insert");
  });

  test("should return 'update' when all generated fields are present", () => {
    const entity = { id: "some-uuid", name: "test" } as GetSaveStrategyGenerated;
    expect(getSaveStrategy(GetSaveStrategyGenerated, entity)).toBe("update");
  });

  test("should return 'unknown' when no version or generated markers", () => {
    const entity = { id: "abc", name: "test" } as GetSaveStrategyNoMarkers;
    expect(getSaveStrategy(GetSaveStrategyNoMarkers, entity)).toBe("unknown");
  });
});
