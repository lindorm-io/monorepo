import type { StagedMetadata } from "../internal/metadata";
import { Timeout } from "./Timeout";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Timeout", () => {
  test("should stage dto metadata with snake_case name derived from class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestTimeoutReminder {}

    Timeout()(TestTimeoutReminder, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name when provided as string", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestTimeoutReminder {}

    Timeout("custom_timeout_name")(TestTimeoutReminder, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name and version when provided as options", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestTimeoutReminder {}

    Timeout({ name: "my_timeout", version: 3 })(
      TestTimeoutReminder,
      createMockContext(metadata),
    );

    expect(metadata).toMatchSnapshot();
  });

  test("should extract version from class name _V2 suffix", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestTimeoutReminder_V2 {}

    Timeout()(TestTimeoutReminder_V2, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should default version to 1 when no suffix is present", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestSimpleTimeout {}

    Timeout()(TestSimpleTimeout, createMockContext(metadata));

    expect((metadata as StagedMetadata).dto!.version).toBe(1);
  });
});
