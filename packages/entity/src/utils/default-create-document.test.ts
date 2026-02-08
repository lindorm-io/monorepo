import {
  TestRelationFour,
  TestRelationOne,
  TestRelationThree,
  TestRelationTwo,
} from "../__fixtures__/test-relations";
import { defaultCreateDocument } from "./default-create-document";
import { defaultCreateEntity } from "./default-create-entity";

describe("defaultCreateDocument", () => {
  let entity: TestRelationOne;

  beforeEach(() => {
    entity = defaultCreateEntity(TestRelationOne, {
      name: "one-1",
      twos: [
        {
          first: "two-1-first",
          second: "two-1-second",
          name: "two-1",
          threes: [
            {
              name: "three-1",
            },
            {
              name: "three-2",
            },
          ],
        },
        {
          first: "two-2-first",
          second: "two-2-second",
          name: "two-2",
          threes: [
            {
              name: "three-3",
            },
          ],
        },
      ],
      threes: [],
      four: { name: "four-1" },
    });
  });

  test("should create without join keys for apex entity", () => {
    expect(defaultCreateDocument(TestRelationOne, entity)).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      name: "one-1",
    });
  });

  test("should create with join keys for many-to-one relation", () => {
    expect(defaultCreateDocument(TestRelationTwo, entity.twos[0])).toEqual({
      first: "two-1-first",
      second: "two-1-second",
      name: "two-1",
      customOneId: entity.id,
    });
  });

  test("should create with join keys for deep many-to-one relation", () => {
    expect(defaultCreateDocument(TestRelationThree, entity.twos[0].threes[0])).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      twoFirst: "two-1-first",
      twoSecond: "two-1-second",
      name: "three-1",
      twoId: entity.twos[0].id,
    });
  });

  test("should create with join keys for one-to-one relation", () => {
    expect(defaultCreateDocument(TestRelationFour, entity.four)).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      name: "four-1",
      customFourId: entity.id,
    });
  });
});
