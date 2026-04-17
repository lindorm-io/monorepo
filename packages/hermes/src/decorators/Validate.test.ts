import type { StagedMetadata } from "../internal/metadata";
import { z } from "zod";
import { Validate } from "./Validate";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("Validate", () => {
  test("should add zod schema validation for the decorated method name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    const schema = z.object({ input: z.string() });
    const fn = () => {};
    Validate(schema)(fn, createMockMethodContext(metadata, "handleCreate"));

    const staged = metadata as StagedMetadata;
    expect(staged.validations).toHaveLength(1);
    expect(staged.validations![0].methodName).toBe("handleCreate");
    expect(staged.validations![0].schema).toBe(schema);
  });
});
