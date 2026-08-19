import type { GherkinError } from "../errors/GherkinError.js";

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
  title: error.title,
  type: error.type,
});
