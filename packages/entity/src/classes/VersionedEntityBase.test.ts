import { Entity } from "../decorators";
import { globalEntityMetadata } from "../utils";
import { VersionedEntityBase } from "./VersionedEntityBase";

describe("VersionedEntityBase", () => {
  test("should have expected properties", () => {
    @Entity()
    class TestVersionedEntityBase extends VersionedEntityBase {}

    expect(new TestVersionedEntityBase()).toMatchSnapshot();
    expect(globalEntityMetadata.get(TestVersionedEntityBase)).toMatchSnapshot();
  });
});
