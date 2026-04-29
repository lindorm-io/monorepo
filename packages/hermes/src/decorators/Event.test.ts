import type { StagedMetadata } from "../internal/metadata/index.js";
import { Event } from "./Event.js";
import { describe, expect, test } from "vitest";

const createMockContext = (metadata: DecoratorMetadataObject): ClassDecoratorContext =>
  ({ metadata }) as ClassDecoratorContext;

describe("Event", () => {
  test("should stage dto metadata with snake_case name derived from class name", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestEventCreate {}

    Event()(TestEventCreate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name when provided as string", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestEventCreate {}

    Event("custom_event_name")(TestEventCreate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should stage dto metadata with custom name and version when provided as options", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestEventCreate {}

    Event({ name: "my_event", version: 3 })(TestEventCreate, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should extract version from class name _V2 suffix", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestEventCreate_V2 {}

    Event()(TestEventCreate_V2, createMockContext(metadata));

    expect(metadata).toMatchSnapshot();
  });

  test("should default version to 1 when no suffix is present", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class TestSimpleEvent {}

    Event()(TestSimpleEvent, createMockContext(metadata));

    expect((metadata as StagedMetadata).dto!.version).toBe(1);
  });
});
