import { EntityKitError } from "../errors";
import { Entity, PrimaryKeyColumn } from "../decorators";
import { getIncrementName } from "./get-increment-name";

describe("getIncrementName", () => {
  test("should get default increment name", () => {
    @Entity()
    class TestNameEntityOne {
      @PrimaryKeyColumn()
      primaryKey!: string;
    }

    expect(getIncrementName(TestNameEntityOne, {})).toEqual(
      "increment.test_name_entity_one",
    );
  });

  test("should get default increment name with entity namespace", () => {
    @Entity({ namespace: "custom" })
    class TestNameEntityTwo {
      @PrimaryKeyColumn()
      primaryKey!: string;
    }

    expect(getIncrementName(TestNameEntityTwo, { namespace: "namespace" })).toEqual(
      "custom.increment.test_name_entity_two",
    );
  });

  test("should get default increment name with options namespace", () => {
    @Entity()
    class TestNameEntityThree {
      @PrimaryKeyColumn()
      primaryKey!: string;
    }

    expect(getIncrementName(TestNameEntityThree, { namespace: "namespace" })).toEqual(
      "namespace.increment.test_name_entity_three",
    );
  });

  test("should throw EntityKitError for reserved 'system' namespace", () => {
    @Entity({ namespace: "system" })
    class TestNameEntitySystem {
      @PrimaryKeyColumn()
      primaryKey!: string;
    }

    expect(() => getIncrementName(TestNameEntitySystem, {})).toThrow(EntityKitError);
    expect(() => getIncrementName(TestNameEntitySystem, {})).toThrow(
      "reserved for internal use",
    );
  });
});
