import { Min } from "./Min";

describe("Min", () => {
  it("should stage field modifier with min value", () => {
    class TestMsg {
      @Min(5)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      count!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should handle zero", () => {
    class TestMsg {
      @Min(0)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      count!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers[0].min).toBe(0);
  });

  it("should handle negative values", () => {
    class TestMsg {
      @Min(-100)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      temp!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers[0].min).toBe(-100);
  });
});
