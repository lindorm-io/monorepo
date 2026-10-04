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

export const defineThrowingGetter = <T extends object>(target: T, key: string): T =>
  Object.defineProperty(target, key, {
    get: (): never => {
      throw new TypeError(`${key} getter boom`);
    },
  });

export const proxyWithThrowingTraps = (): object =>
  new Proxy(
    {},
    {
      get: () => {
        throw new TypeError("trap: get");
      },
      getPrototypeOf: () => {
        throw new TypeError("trap: getPrototypeOf");
      },
    },
  );

export const revokedProxy = (): object => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();

  return proxy;
};

/** `build` returns a fresh value. */
export const UNREADABLE_THROWS: Array<{ label: string; build: () => unknown }> = [
  {
    label: "an error whose message has no string form",
    build: () => {
      const error = new Error("replaced");
      (error as { message: unknown }).message = Object.create(null);
      return error;
    },
  },
  {
    label: "an error whose message getter throws",
    build: () => defineThrowingGetter(new Error("hidden"), "message"),
  },
  { label: "a value with no string form", build: () => Object.create(null) },
  { label: "a proxy whose traps throw", build: proxyWithThrowingTraps },
];

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

export const captureRejection = async (
  fn: () => unknown,
): Promise<{ error: unknown }> => {
  try {
    await fn();
  } catch (error) {
    return { error };
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
