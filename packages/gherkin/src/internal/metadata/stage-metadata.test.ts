import { describe, expect, test } from "vitest";
import {
  readOwnParameterTypes,
  readOwnSteps,
  stageParameterType,
  stageStep,
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
});
