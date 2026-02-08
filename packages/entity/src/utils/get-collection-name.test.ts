import { EntityKitError } from "../errors";
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

  test("should get collection name with custom separator", () => {
    @Entity({ namespace: "ns" })
    class TestNameEntitySep {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(getCollectionName(TestNameEntitySep, { separator: ":" })).toEqual(
      "ns:entity:test_name_entity_sep",
    );
  });

  test("should throw EntityKitError for reserved 'system' namespace", () => {
    @Entity({ namespace: "system" })
    class TestNameEntitySystem {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(() => getCollectionName(TestNameEntitySystem, {})).toThrow(EntityKitError);
    expect(() => getCollectionName(TestNameEntitySystem, {})).toThrow(
      "reserved for internal use",
    );
  });
});
