import {
  stageDto,
  stageAggregate,
  stageSaga,
  stageView,
  stageNamespace,
  stageForgettable,
  stageHandler,
  stageMethodModifier,
  stageValidation,
} from "./stage-metadata.js";
import type {
  MetaAggregate,
  MetaDto,
  MetaForgettable,
  MetaHandler,
  MetaMethodModifier,
  MetaSaga,
  MetaValidation,
  MetaView,
} from "./types.js";
import { z } from "zod";
import { describe, expect, it } from "vitest";

const createMetadata = (): DecoratorMetadataObject =>
  Object.create(null) as DecoratorMetadataObject;

describe("stageDto", () => {
  it("should set dto on metadata", () => {
    const metadata = createMetadata();
    const dto: MetaDto = { kind: "command", name: "test_create", version: 1 };

    stageDto(metadata, dto);

    expect(metadata).toMatchSnapshot();
  });
});

describe("stageAggregate", () => {
  it("should set aggregate on metadata", () => {
    const metadata = createMetadata();
    const aggregate: MetaAggregate = { name: "test_aggregate" };

    stageAggregate(metadata, aggregate);

    expect(metadata).toMatchSnapshot();
  });
});

describe("stageSaga", () => {
  it("should set saga on metadata", () => {
    const metadata = createMetadata();

    class FakeAggregate {}
    const saga: MetaSaga = { name: "test_saga", aggregates: [FakeAggregate] };

    stageSaga(metadata, saga);

    expect(metadata.saga).toBe(saga);
  });
});

describe("stageView", () => {
  it("should set view on metadata", () => {
    const metadata = createMetadata();

    class FakeAggregate {}
    class FakeEntity {}
    const view: MetaView = {
      name: "test_view",
      aggregates: [FakeAggregate],
      entity: FakeEntity,
      driverType: null,
    };

    stageView(metadata, view);

    expect(metadata.view).toBe(view);
  });
});

describe("stageNamespace", () => {
  it("should set namespace on metadata", () => {
    const metadata = createMetadata();

    stageNamespace(metadata, "billing");

    expect(metadata).toMatchSnapshot();
  });
});

describe("stageForgettable", () => {
  it("should set forgettable on metadata", () => {
    const metadata = createMetadata();
    const forgettable: MetaForgettable = { forgettable: true };

    stageForgettable(metadata, forgettable);

    expect(metadata).toMatchSnapshot();
  });
});

describe("stageHandler", () => {
  it("should create handlers array and push", () => {
    const metadata = createMetadata();

    class FakeTrigger {}
    const handler: MetaHandler = {
      kind: "AggregateCommandHandler",
      methodName: "handleCreate",
      trigger: FakeTrigger,
    };

    stageHandler(metadata, handler);

    expect(metadata.handlers).toHaveLength(1);
    expect((metadata.handlers as Array<MetaHandler>)[0]).toBe(handler);
  });

  it("should append to existing handlers array", () => {
    const metadata = createMetadata();

    class FakeTriggerA {}
    class FakeTriggerB {}

    const handlerA: MetaHandler = {
      kind: "AggregateCommandHandler",
      methodName: "handleCreate",
      trigger: FakeTriggerA,
    };
    const handlerB: MetaHandler = {
      kind: "AggregateEventHandler",
      methodName: "onCreate",
      trigger: FakeTriggerB,
    };

    stageHandler(metadata, handlerA);
    stageHandler(metadata, handlerB);

    expect(metadata.handlers).toHaveLength(2);
    expect((metadata.handlers as Array<MetaHandler>)[0]).toBe(handlerA);
    expect((metadata.handlers as Array<MetaHandler>)[1]).toBe(handlerB);
  });
});

describe("stageMethodModifier", () => {
  it("should create methodModifiers array and push", () => {
    const metadata = createMetadata();
    const modifier: MetaMethodModifier = {
      methodName: "handleCreate",
      modifier: "requireNotCreated",
    };

    stageMethodModifier(metadata, modifier);

    expect(metadata.methodModifiers).toHaveLength(1);
    expect((metadata.methodModifiers as Array<MetaMethodModifier>)[0]).toBe(modifier);
  });

  it("should append to existing methodModifiers array", () => {
    const metadata = createMetadata();
    const modifierA: MetaMethodModifier = {
      methodName: "handleCreate",
      modifier: "requireNotCreated",
    };
    const modifierB: MetaMethodModifier = {
      methodName: "handleMerge",
      modifier: "requireCreated",
    };

    stageMethodModifier(metadata, modifierA);
    stageMethodModifier(metadata, modifierB);

    expect(metadata.methodModifiers).toHaveLength(2);
  });
});

describe("stageValidation", () => {
  it("should create validations array and push", () => {
    const metadata = createMetadata();
    const schema = z.object({ input: z.string() });
    const validation: MetaValidation = {
      methodName: "handleCreate",
      schema,
    };

    stageValidation(metadata, validation);

    expect(metadata.validations).toHaveLength(1);
    expect((metadata.validations as Array<MetaValidation>)[0]).toBe(validation);
  });

  it("should append to existing validations array", () => {
    const metadata = createMetadata();
    const schemaA = z.object({ input: z.string() });
    const schemaB = z.object({ other: z.number() });

    stageValidation(metadata, { methodName: "handleCreate", schema: schemaA });
    stageValidation(metadata, { methodName: "handleUpdate", schema: schemaB });

    expect(metadata.validations).toHaveLength(2);
  });
});

describe("ensureOwnArray (prototype inheritance guard)", () => {
  it("should NOT inherit handlers from prototype chain", () => {
    class FakeTriggerParent {}
    class FakeTriggerChild {}

    const parent = createMetadata();
    const parentHandler: MetaHandler = {
      kind: "AggregateCommandHandler",
      methodName: "parentMethod",
      trigger: FakeTriggerParent,
    };
    stageHandler(parent, parentHandler);

    // Child inherits from parent via prototype chain
    const child = Object.create(parent) as DecoratorMetadataObject;
    const childHandler: MetaHandler = {
      kind: "AggregateEventHandler",
      methodName: "childMethod",
      trigger: FakeTriggerChild,
    };
    stageHandler(child, childHandler);

    // Child should have its OWN handlers array, not parent's
    expect(Object.hasOwn(child, "handlers")).toBe(true);
    expect(child.handlers).toHaveLength(1);
    expect((child.handlers as Array<MetaHandler>)[0]).toBe(childHandler);

    // Parent's array should be unmodified
    expect(parent.handlers).toHaveLength(1);
    expect((parent.handlers as Array<MetaHandler>)[0]).toBe(parentHandler);
  });
});
