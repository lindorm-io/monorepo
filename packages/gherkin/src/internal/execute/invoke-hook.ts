import { isError } from "@lindorm/is";
import type { StepFn } from "../../types/step-fn.js";
import type { RegistryHook } from "../registry/types.js";

export type InvokeHookOptions = {
  args: Array<unknown>;
  /** Wraps the original message with the hook's anchor (format-hook-failure.ts). */
  format: (message: string) => string;
  hook: RegistryHook;
  /** The scenario's binding instance — or the CLASS itself for static feature hooks. */
  instance: object;
};

/**
 * AWAITED: a hook returning a rejecting promise must fail the scenario here,
 * not surface as an unhandled-rejection side note attributed to whichever
 * test happens to be running. The original error is rethrown with its message
 * extended in place — rethrowing the same instance keeps the stack and the
 * assertion actual/expected pair, so vitest still prints an expect() diff.
 */
export const invokeHook = async ({
  args,
  format,
  hook,
  instance,
}: InvokeHookOptions): Promise<void> => {
  try {
    await (instance as Record<string, StepFn>)[hook.methodName](...args);
  } catch (error) {
    if (isError(error)) {
      error.message = format(error.message);
      throw error;
    }

    throw new Error(format(String(error)), { cause: error });
  }
};
