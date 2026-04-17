import type { StagedMetadata } from "../internal/metadata";
import { ViewIdHandler } from "./ViewIdHandler";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("ViewIdHandler", () => {
  test("should stage handler with correct kind, trigger, and methodName", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FakeEvent {}

    const fn = () => {};
    ViewIdHandler(FakeEvent)(fn, createMockMethodContext(metadata, "resolveId"));

    const staged = metadata as StagedMetadata;
    expect(staged.handlers).toHaveLength(1);
    expect(staged.handlers![0].kind).toBe("ViewIdHandler");
    expect(staged.handlers![0].methodName).toBe("resolveId");
    expect(staged.handlers![0].trigger).toBe(FakeEvent);
  });
});
