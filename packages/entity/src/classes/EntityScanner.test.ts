import { join } from "path";
import { TestEntityOne } from "../__fixtures__/entities/test-entity-one";
import TestEntityThree from "../__fixtures__/entities/test-entity-three";
import { TestEntityTwo } from "../__fixtures__/entities/test-entity-two";
import { EntityScanner } from "./EntityScanner";

describe("EntityScanner", () => {
  test("should return with array of entity constructors", () => {
    expect(EntityScanner.scan([TestEntityOne, TestEntityTwo, TestEntityThree])).toEqual([
      TestEntityOne,
      TestEntityTwo,
      TestEntityThree,
    ]);
  });

  test("should return with array of entity paths", () => {
    expect(
      EntityScanner.scan([join(__dirname, "..", "__fixtures__", "entities")]),
    ).toEqual([TestEntityOne, TestEntityThree, TestEntityTwo]);
  });
});
