import { Generated } from "./Generated";
import { describe, expect, it } from "vitest";

describe("Generated", () => {
  it("should stage generated with uuid strategy", () => {
    class TestMsg {
      @Generated("uuid")
      id!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated).toMatchSnapshot();
  });

  it("should stage generated with string strategy and length", () => {
    class TestMsg {
      @Generated("string", { length: 12 })
      code!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated).toMatchSnapshot();
  });

  it("should stage generated with integer strategy and range", () => {
    class TestMsg {
      @Generated("integer", { min: 1, max: 1000 })
      sequence!: number;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated).toMatchSnapshot();
  });

  it("should stage generated with date strategy", () => {
    class TestMsg {
      @Generated("date")
      createdAt!: Date;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.generated).toMatchSnapshot();
  });

  it("should default options to null", () => {
    class TestMsg {
      @Generated("float")
      value!: number;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    const gen = metadata.generated[0];
    expect(gen.length).toBeNull();
    expect(gen.max).toBeNull();
    expect(gen.min).toBeNull();
  });
});
