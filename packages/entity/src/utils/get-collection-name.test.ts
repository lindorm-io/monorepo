import { Entity, PrimaryKeyColumn } from "../decorators";
import { getCollectionName } from "./get-collection-name";

describe("getCollectionName", () => {
  test("should get default collection name", () => {
    @Entity()
    class TestNameEntityOne {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(getCollectionName(TestNameEntityOne, {})).toEqual(
      "entity.test_name_entity_one",
    );
  });

  test("should get default collection name with entity namespace", () => {
    @Entity({ namespace: "custom" })
    class TestNameEntityTwo {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(getCollectionName(TestNameEntityTwo, { namespace: "namespace" })).toEqual(
      "custom.entity.test_name_entity_two",
    );
  });

  test("should get default collection name with options namespace", () => {
    @Entity()
    class TestNameEntityThree {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(getCollectionName(TestNameEntityThree, { namespace: "namespace" })).toEqual(
      "namespace.entity.test_name_entity_three",
    );
  });
});
