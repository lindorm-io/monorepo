import { ManyToManyFirstDecoratorEntity } from "../__fixtures__/relations/ManyToManyFirst";
import { ManyToManySecondDecoratorEntity } from "../__fixtures__/relations/ManyToManySecond";
import { globalEntityMetadata } from "../utils";

describe("ManyToMany Decorator", () => {
  test("should add metadata", () => {
    expect(globalEntityMetadata.get(ManyToManyFirstDecoratorEntity)).toMatchSnapshot();
    expect(globalEntityMetadata.get(ManyToManySecondDecoratorEntity)).toMatchSnapshot();

    const Second = globalEntityMetadata
      .get(ManyToManyFirstDecoratorEntity)
      .relations[0]!.foreignConstructor();
    const First = globalEntityMetadata
      .get(ManyToManySecondDecoratorEntity)
      .relations[0]!.foreignConstructor();

    expect(new Second()).toBeInstanceOf(ManyToManySecondDecoratorEntity);
    expect(new First()).toBeInstanceOf(ManyToManyFirstDecoratorEntity);
  });
});
