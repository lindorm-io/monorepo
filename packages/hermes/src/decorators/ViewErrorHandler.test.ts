import type { StagedMetadata } from "../internal/metadata";
import { ViewErrorHandler } from "./ViewErrorHandler";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("ViewErrorHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeError {}

    const fn = () => {};
    ViewErrorHandler(FakeError)(fn, createMockMethodContext(metadata, "onError"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("ViewErrorHandler");
    expect(staged.handlers![0].methodName).toBe("onError");
    expect(staged.handlers![0].trigger).toBe(FakeError);
  });
});
