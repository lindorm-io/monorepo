import { Entity } from "../decorators";
import { globalEntityMetadata } from "../utils";
import { EntityBase } from "./EntityBase";

describe("EntityBase", () => {
  test("should have expected properties", () => {
    @Entity()
    class TestEntityBase extends EntityBase {}

    expect(new TestEntityBase()).toMatchSnapshot();
    expect(globalEntityMetadata.get(TestEntityBase)).toMatchSnapshot();
  });
});
