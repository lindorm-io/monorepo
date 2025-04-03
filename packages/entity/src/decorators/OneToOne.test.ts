import { OneToOneFirstDecoratorEntity } from "../__fixtures__/relations/OneToOneFirst";
import { OneToOneSecondDecoratorEntity } from "../__fixtures__/relations/OneToOneSecond";
import { globalEntityMetadata } from "../utils";

describe("OneToOne Decorator", () => {
  test("should add metadata", () => {
    expect(globalEntityMetadata.get(OneToOneFirstDecoratorEntity)).toMatchSnapshot();
    expect(globalEntityMetadata.get(OneToOneSecondDecoratorEntity)).toMatchSnapshot();

    const Second = globalEntityMetadata
      .get(OneToOneFirstDecoratorEntity)
      .relations[0]!.foreignConstructor();
    const First = globalEntityMetadata
      .get(OneToOneSecondDecoratorEntity)
      .relations[0]!.foreignConstructor();

    expect(new Second()).toBeInstanceOf(OneToOneSecondDecoratorEntity);
    expect(new First()).toBeInstanceOf(OneToOneFirstDecoratorEntity);
  });
});
