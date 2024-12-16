import { join } from "path";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { TestEntityTwo } from "../../__fixtures__/entities/test-entity-two";
import { TestEntity } from "../../__fixtures__/test-entity";
import { EntityScanner } from "./EntityScanner";

describe("EntityScanner", () => {
  test("should return with array of entity constructors", () => {
    expect(EntityScanner.scan([TestEntity, TestEntityOne, TestEntityTwo])).toEqual([
      { Entity: TestEntity },
      { Entity: TestEntityOne },
      { Entity: TestEntityTwo },
    ]);
  });

  test("should return with array of entity options objects", () => {
    expect(
      EntityScanner.scan([
        { Entity: TestEntity, validate: jest.fn() },
        { Entity: TestEntityOne, validate: jest.fn() },
        { Entity: TestEntityTwo, config: { useSoftDelete: true }, mappings: {} },
      ]),
    ).toEqual([
      { Entity: TestEntity, validate: expect.any(Function) },
      {
        Entity: TestEntityOne,
        validate: expect.any(Function),
      },
      { Entity: TestEntityTwo, config: { useSoftDelete: true }, mappings: {} },
    ]);
  });

  test("should return with array of entity paths", () => {
    expect(
      EntityScanner.scan([join(__dirname, "..", "..", "__fixtures__", "entities")]),
    ).toEqual([
      {
        Entity: TestEntityOne,
        config: { useSoftDelete: true },
        mappings: expect.any(Object),
        validate: expect.any(Function),
      },
      { Entity: TestEntityTwo, mappings: expect.any(Object) },
    ]);
  });
});
