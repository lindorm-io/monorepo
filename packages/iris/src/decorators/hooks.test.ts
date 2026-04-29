import { OnCreate } from "./OnCreate.js";
import { OnHydrate } from "./OnHydrate.js";
import { OnValidate } from "./OnValidate.js";
import { BeforePublish } from "./BeforePublish.js";
import { AfterPublish } from "./AfterPublish.js";
import { BeforeConsume } from "./BeforeConsume.js";
import { AfterConsume } from "./AfterConsume.js";
import { OnConsumeError } from "./OnConsumeError.js";
import { describe, expect, it } from "vitest";

const hookDecorators = [
  { name: "OnCreate", Decorator: OnCreate },
  { name: "OnHydrate", Decorator: OnHydrate },
  { name: "OnValidate", Decorator: OnValidate },
  { name: "BeforePublish", Decorator: BeforePublish },
  { name: "AfterPublish", Decorator: AfterPublish },
  { name: "BeforeConsume", Decorator: BeforeConsume },
  { name: "AfterConsume", Decorator: AfterConsume },
] as const;

describe.each(hookDecorators)("$name", ({ name, Decorator }) => {
  it("should stage hook metadata", () => {
    const cb = (msg: any) => {
      msg.touched = true;
    };

    @((Decorator as any)(cb))
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.hooks).toHaveLength(1);
    expect(meta.hooks[0].decorator).toBe(name);
    expect(meta.hooks[0].callback).toBe(cb);
  });

  it("should accept async callbacks", () => {
    const cb = async (msg: any) => {
      msg.touched = true;
    };

    @((Decorator as any)(cb))
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.hooks[0].callback).toBe(cb);
  });
});

describe("OnConsumeError", () => {
  it("should stage hook metadata with wrapped callback", () => {
    const cb = (error: Error, msg: any) => {
      msg.touched = true;
    };

    @OnConsumeError(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.hooks).toHaveLength(1);
    expect(meta.hooks[0].decorator).toBe("OnConsumeError");
    expect(typeof meta.hooks[0].callback).toBe("function");
  });

  it("should accept async callbacks", () => {
    const cb = async (error: Error, msg: any) => {
      msg.touched = true;
    };

    @OnConsumeError(cb)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(typeof meta.hooks[0].callback).toBe("function");
  });
});

describe("multiple hooks on one class", () => {
  it("should accumulate hooks in order", () => {
    const cb1 = () => {};
    const cb2 = () => {};
    const cb3 = () => {};

    @OnCreate(cb1)
    @BeforePublish(cb2)
    @AfterConsume(cb3)
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.hooks).toHaveLength(3);
    expect(meta.hooks.map((h: any) => h.decorator)).toMatchSnapshot();
  });
});
