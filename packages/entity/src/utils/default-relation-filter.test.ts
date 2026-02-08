import {
  TestRelationFour,
  TestRelationOne,
  TestRelationThree,
  TestRelationTwo,
} from "../__fixtures__/test-relations";
import { defaultCreateEntity } from "./default-create-entity";
import { defaultRelationFilter } from "./default-relation-filter";
import { globalEntityMetadata } from "./global";

describe("defaultRelationFilter", () => {
  let entity: TestRelationOne;

  beforeEach(() => {
    entity = defaultCreateEntity(TestRelationOne, {
      name: "one",
      twos: [
        {
          first: "two-1-first",
          second: "two-1-second",
          name: "two-1",
          threes: [{ name: "three-1" }],
        },
      ],
      four: { name: "four" },
    });
  });

  test("should build filter for OneToMany relation", () => {
    const metadata = globalEntityMetadata.get(TestRelationOne);
    const relation = metadata.relations.find((r) => r.key === "twos")!;

    expect(defaultRelationFilter(relation, entity)).toEqual({
      customOneId: entity.id,
    });
  });

  test("should build filter for ManyToOne relation with explicit joinKeys", () => {
    const metadata = globalEntityMetadata.get(TestRelationTwo);
    const relation = metadata.relations.find((r) => r.key === "one")!;

    expect(defaultRelationFilter(relation, entity.twos[0])).toEqual({
      id: entity.twos[0].customOneId,
    });
  });

  test("should build filter for ManyToOne relation with auto-inferred joinKeys", () => {
    const metadata = globalEntityMetadata.get(TestRelationThree);
    const relation = metadata.relations.find((r) => r.key === "two")!;

    expect(defaultRelationFilter(relation, entity.twos[0].threes[0])).toEqual({
      first: entity.twos[0].threes[0].twoFirst,
      second: entity.twos[0].threes[0].twoSecond,
    });
  });

  test("should build filter for inverse OneToOne relation", () => {
    const metadata = globalEntityMetadata.get(TestRelationOne);
    const relation = metadata.relations.find((r) => r.key === "four")!;

    expect(defaultRelationFilter(relation, entity)).toEqual({
      customFourId: entity.id,
    });
  });

  test("should build filter for owning OneToOne relation", () => {
    const metadata = globalEntityMetadata.get(TestRelationFour);
    const relation = metadata.relations.find((r) => r.key === "one")!;

    expect(defaultRelationFilter(relation, entity.four)).toEqual({
      id: entity.four.customFourId,
    });
  });

  test("should throw when findKeys is null", () => {
    const relation = {
      key: "test",
      findKeys: null,
      type: "OneToMany" as const,
    } as any;

    expect(() => defaultRelationFilter(relation, entity)).toThrow(
      "Cannot build relation filter without findKeys",
    );
  });
});
