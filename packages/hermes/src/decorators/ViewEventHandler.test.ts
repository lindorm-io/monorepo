import type { StagedMetadata } from "../internal/metadata";
import { ViewEventHandler } from "./ViewEventHandler";
import { describe, expect, test } from "vitest";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("ViewEventHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeEvent {}

    const fn = () => {};
    ViewEventHandler(FakeEvent)(fn, createMockMethodContext(metadata, "onCreateEvent"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("ViewEventHandler");
    expect(staged.handlers![0].methodName).toBe("onCreateEvent");
    expect(staged.handlers![0].trigger).toBe(FakeEvent);
  });
});
