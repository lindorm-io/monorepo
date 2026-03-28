import { Max } from "./Max";

describe("Max", () => {
  it("should stage field modifier with max value", () => {
    class TestMsg {
      @Max(100)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      count!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers).toHaveLength(1);
    expect(meta.fieldModifiers[0]).toMatchSnapshot();
  });

  it("should handle zero", () => {
    class TestMsg {
      @Max(0)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      count!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers[0].max).toBe(0);
  });

  it("should handle negative values", () => {
    class TestMsg {
      @Max(-1)
      @((_t: undefined, _c: ClassFieldDecoratorContext) => {})
      temp!: number;
    }

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.fieldModifiers[0].max).toBe(-1);
  });
});
