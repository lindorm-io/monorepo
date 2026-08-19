import { describe, expect, test } from "vitest";
import {
  readOwnHooks,
  readOwnInjects,
  readOwnParameterTypes,
  readOwnPriorities,
  readOwnSteps,
  stageHook,
  stageInject,
  stageParameterType,
  stagePriority,
  stageStep,
  toModifierKey,
} from "./stage-metadata.js";
import type { StagedParameterType } from "./staged.js";
import { PARAMETER_TYPES_METADATA, STEPS_METADATA } from "./symbols.js";

const parameterType = (methodName: string): StagedParameterType => ({
  methodName,
  name: methodName,
  options: {},
  regexp: /\w+/,
  transform: (raw: string) => raw,
});

describe("stage-metadata", () => {
  test("should append staged steps to the same own array", () => {
    const metadata: DecoratorMetadataObject = {};

    stageStep(metadata, { decorator: "Given", expression: "first", methodName: "first" });
    stageStep(metadata, {
      decorator: "When",
      expression: "second",
      methodName: "second",
    });

    expect(readOwnSteps(metadata)).toEqual([
      { decorator: "Given", expression: "first", methodName: "first" },
      { decorator: "When", expression: "second", methodName: "second" },
    ]);
  });

  test("staging on a subclass metadata object should NOT mutate the parent's array through the prototype chain", () => {
    const parent: DecoratorMetadataObject = {};
    stageStep(parent, {
      decorator: "Given",
      expression: "parent step",
      methodName: "parent",
    });

    // TC39 semantics: a subclass metadata object's prototype is the parent's.
    const child: DecoratorMetadataObject = Object.create(parent);
    stageStep(child, {
      decorator: "Then",
      expression: "child step",
      methodName: "child",
    });

    expect(parent[STEPS_METADATA]).toEqual([
      { decorator: "Given", expression: "parent step", methodName: "parent" },
    ]);
    expect(readOwnSteps(child)).toEqual([
      { decorator: "Then", expression: "child step", methodName: "child" },
    ]);
  });

  test("readOwnSteps should ignore inherited arrays", () => {
    const parent: DecoratorMetadataObject = {};
    stageStep(parent, {
      decorator: "Given",
      expression: "parent step",
      methodName: "parent",
    });

    const child: DecoratorMetadataObject = Object.create(parent);

    expect(readOwnSteps(child)).toEqual([]);
  });

  test("should stage parameter types with the same own-array discipline", () => {
    const parent: DecoratorMetadataObject = {};
    stageParameterType(parent, parameterType("first"));
    stageParameterType(parent, parameterType("second"));

    const child: DecoratorMetadataObject = Object.create(parent);
    stageParameterType(child, parameterType("third"));

    expect(
      (parent[PARAMETER_TYPES_METADATA] as Array<StagedParameterType>).map(
        (staged) => staged.methodName,
      ),
    ).toEqual(["first", "second"]);
    expect(readOwnParameterTypes(child).map((staged) => staged.methodName)).toEqual([
      "third",
    ]);
  });

  test("readOwnParameterTypes should ignore inherited arrays", () => {
    const parent: DecoratorMetadataObject = {};
    stageParameterType(parent, parameterType("first"));

    const child: DecoratorMetadataObject = Object.create(parent);

    expect(readOwnParameterTypes(child)).toEqual([]);
  });

  test("should stage hooks with the same own-array discipline and ignore inherited arrays", () => {
    const parent: DecoratorMetadataObject = {};
    stageHook(parent, { kind: "BeforeScenario", methodName: "seed", static: false });

    const child: DecoratorMetadataObject = Object.create(parent);
    stageHook(child, {
      kind: "AfterScenario",
      methodName: "dump",
      static: false,
      tagExpression: "@integration",
    });

    expect(readOwnHooks(parent)).toEqual([
      { kind: "BeforeScenario", methodName: "seed", static: false },
    ]);
    expect(readOwnHooks(child)).toEqual([
      {
        kind: "AfterScenario",
        methodName: "dump",
        static: false,
        tagExpression: "@integration",
      },
    ]);
    expect(readOwnHooks(Object.create(parent))).toEqual([]);
  });

  test("should stage injects with the same own-array discipline and ignore inherited arrays", () => {
    class Token {}

    const parent: DecoratorMetadataObject = {};
    stageInject(parent, { fieldName: "aes", token: Token });

    const child: DecoratorMetadataObject = Object.create(parent);

    expect(readOwnInjects(parent)).toEqual([{ fieldName: "aes", token: Token }]);
    expect(readOwnInjects(child)).toEqual([]);
  });

  test("should stage priorities with the same own-array discipline and ignore inherited arrays", () => {
    const parent: DecoratorMetadataObject = {};
    stagePriority(parent, {
      key: "false:seed",
      methodName: "seed",
      priority: 100,
      static: false,
    });

    const child: DecoratorMetadataObject = Object.create(parent);

    expect(readOwnPriorities(parent)).toEqual([
      { key: "false:seed", methodName: "seed", priority: 100, static: false },
    ]);
    expect(readOwnPriorities(child)).toEqual([]);
  });

  test("toModifierKey should separate a static and an instance member of the same name", () => {
    expect(toModifierKey(true, "setup")).toEqual("true:setup");
    expect(toModifierKey(false, "setup")).toEqual("false:setup");
    expect(toModifierKey(true, "setup")).not.toEqual(toModifierKey(false, "setup"));
  });
});
