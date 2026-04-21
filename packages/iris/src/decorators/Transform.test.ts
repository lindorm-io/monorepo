import { Transform } from "./Transform";
import { describe, expect, it } from "vitest";

describe("Transform", () => {
  it("should stage transform data without creating a field entry", () => {
    const to = (v: unknown) => JSON.stringify(v);
    const from = (v: unknown) => JSON.parse(v as string);

    class TestMsg {
      @Transform({ to, from })
      payload!: unknown;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.transforms).toHaveLength(1);
    expect(metadata.transforms[0]).toMatchSnapshot({
      transform: { to: expect.any(Function), from: expect.any(Function) },
    });
    expect(metadata.fields).toBeUndefined();
  });
});
