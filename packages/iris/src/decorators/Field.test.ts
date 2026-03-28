import { Field } from "./Field";

describe("Field", () => {
  it("should stage field with explicit type", () => {
    class TestMsg {
      @Field("string")
      name!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });

  it("should stage field with type and options", () => {
    class TestMsg {
      @Field("integer", { nullable: true })
      count!: number | null;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toMatchSnapshot();
  });

  it("should stage field with transform", () => {
    const to = (v: unknown) => String(v);
    const from = (v: unknown) => Number(v);

    class TestMsg {
      @Field("string", { transform: { to, from } })
      value!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(1);
    expect(metadata.fields[0].transform).toEqual({ to, from });
  });

  it("should accumulate multiple fields", () => {
    class TestMsg {
      @Field("string")
      first!: string;

      @Field("integer")
      second!: number;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.fields).toHaveLength(2);
    expect(metadata.fields).toMatchSnapshot();
  });
});
