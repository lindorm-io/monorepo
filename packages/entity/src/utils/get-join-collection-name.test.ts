import { EntityKitError } from "../errors";
import { getJoinCollectionName } from "./get-join-collection-name";

describe("getJoinCollectionName", () => {
  test("should get join collection name without namespace", () => {
    expect(getJoinCollectionName("test_relation_one_x_test_relation_five", {})).toEqual(
      "join.test_relation_one_x_test_relation_five",
    );
  });

  test("should get join collection name with namespace", () => {
    expect(
      getJoinCollectionName("test_relation_one_x_test_relation_five", {
        namespace: "my_ns",
      }),
    ).toEqual("my_ns.join.test_relation_one_x_test_relation_five");
  });

  test("should get join collection name with custom separator", () => {
    expect(
      getJoinCollectionName("test_relation_one_x_test_relation_five", {
        namespace: "ns",
        separator: ":",
      }),
    ).toEqual("ns:join:test_relation_one_x_test_relation_five");
  });

  test("should throw EntityKitError for reserved 'system' namespace", () => {
    expect(() => getJoinCollectionName("test_table", { namespace: "system" })).toThrow(
      EntityKitError,
    );
    expect(() => getJoinCollectionName("test_table", { namespace: "system" })).toThrow(
      "reserved for internal use",
    );
  });

  test("should throw EntityKitError when name exceeds 120 characters", () => {
    const longTable = "a".repeat(120);
    expect(() => getJoinCollectionName(longTable, {})).toThrow(EntityKitError);
    expect(() => getJoinCollectionName(longTable, {})).toThrow("exceeds 120 characters");
  });
});
