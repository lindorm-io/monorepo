import { ManyToOneSecondDecoratorEntity } from "../__fixtures__/relations/ManyToOneSecond";
import { OneToManyFirstDecoratorEntity } from "../__fixtures__/relations/OneToManyFirst";
import { globalEntityMetadata } from "../utils";

describe("ManyToOne Decorator", () => {
  test("should add metadata", () => {
    expect(globalEntityMetadata.get(OneToManyFirstDecoratorEntity)).toMatchSnapshot();
    expect(globalEntityMetadata.get(ManyToOneSecondDecoratorEntity)).toMatchSnapshot();

    const Second = globalEntityMetadata
      .get(OneToManyFirstDecoratorEntity)
      .relations[0]!.foreignConstructor();
    const First = globalEntityMetadata
      .get(ManyToOneSecondDecoratorEntity)
      .relations[0]!.foreignConstructor();

    expect(new Second()).toBeInstanceOf(ManyToOneSecondDecoratorEntity);
    expect(new First()).toBeInstanceOf(OneToManyFirstDecoratorEntity);
  });
});

// this also tests OneToMany
