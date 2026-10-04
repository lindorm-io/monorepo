import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import type { GherkinError } from "../errors/GherkinError.js";

export const ZOD_ISSUES: Array<z.core.$ZodIssue> = [
  { code: "custom", message: "price is not a number", path: ["price"] },
];

export const errorNamed = (
  name: string,
  issues?: unknown,
): Error & { issues?: unknown } => {
  const error: Error & { issues?: unknown } = new Error("the schema rejected the row");

  error.name = name;
  error.issues = issues;

  return error;
};

/** Rejects the class declaration — the later-class-decorator-throws case. */
export const RejectClass =
  () =>
  (target: Constructor): void => {
    throw new Error(`rejected ${target.name}`);
  };

export const capture = (fn: () => unknown): GherkinError => {
  try {
    fn();
  } catch (error) {
    return error as GherkinError;
  }
  throw new Error("expected function to throw");
};

export const captureAsync = async (fn: () => unknown): Promise<GherkinError> => {
  try {
    await fn();
  } catch (error) {
    return error as GherkinError;
  }
  throw new Error("expected function to reject");
};

export const metadataOf = (target: object): DecoratorMetadataObject =>
  (target as any)[(Symbol as { metadata?: symbol }).metadata as symbol];

export const errorShape = (error: GherkinError): object => ({
  code: error.code,
  data: error.data,
  details: error.details,
  message: error.message,
});
