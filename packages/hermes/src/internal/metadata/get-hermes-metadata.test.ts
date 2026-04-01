import { getHermesMetadata } from "./get-hermes-metadata";

describe("getHermesMetadata", () => {
  it("should return metadata from a class with Symbol.metadata set", () => {
    class TestClass {}

    const fakeMetadata = {
      dto: { kind: "command", name: "test", version: 1 },
      handlers: [],
    };
    (TestClass as any)[Symbol.metadata] = fakeMetadata;

    const result = getHermesMetadata(TestClass);

    expect(result).toBe(fakeMetadata);
  });

  it("should return empty object for a class without Symbol.metadata", () => {
    class PlainClass {}

    const result = getHermesMetadata(PlainClass);

    expect(result).toMatchSnapshot();
  });

  it("should return empty object for a class with null metadata", () => {
    class NullMetaClass {}
    (NullMetaClass as any)[Symbol.metadata] = null;

    const result = getHermesMetadata(NullMetaClass);

    expect(result).toMatchSnapshot();
  });

  it("should return the full staged metadata when present", () => {
    class DecoratedClass {}

    const staged = {
      aggregate: { name: "test_aggregate" },
      namespace: "billing",
      handlers: [
        {
          kind: "AggregateCommandHandler",
          methodName: "handleCreate",
          trigger: class FakeTrigger {},
        },
      ],
      methodModifiers: [{ methodName: "handleCreate", modifier: "requireNotCreated" }],
    };
    (DecoratedClass as any)[Symbol.metadata] = staged;

    const result = getHermesMetadata(DecoratedClass);

    expect(result.aggregate).toBe(staged.aggregate);
    expect(result.namespace).toBe("billing");
    expect(result.handlers).toHaveLength(1);
    expect(result.methodModifiers).toHaveLength(1);
  });
});
