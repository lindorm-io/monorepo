import type { StagedMetadata } from "../internal/metadata";
import { Command } from "./Command";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Command", () => {
  test("should stage dto metadata with snake_case name derived from class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestCommandCreate {}

    Command()(TestCommandCreate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name when provided as string", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestCommandCreate {}

    Command("custom_command_name")(TestCommandCreate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name and version when provided as options", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestCommandCreate {}

    Command({ name: "my_command", version: 3 })(
      TestCommandCreate,
      createMockContext(metadata),
    );

    expect(metadata).toMatchSnapshot();
  });

  test("should extract version from class name _V2 suffix", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestCommandCreate_V2 {}

    Command()(TestCommandCreate_V2, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should default version to 1 when no suffix is present", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestSimple {}

    Command()(TestSimple, createMockContext(metadata));

    expect((metadata as StagedMetadata).dto!.version).toBe(1);
  });
});
