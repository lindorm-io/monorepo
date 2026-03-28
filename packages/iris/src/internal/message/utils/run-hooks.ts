import { IrisError } from "../../../errors/IrisError";
import type { MetaHook } from "../types/metadata";
import type { MetaHookDecorator } from "../types/types";

export const runHooksSync = (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  message: unknown,
  context?: unknown,
  ...extra: Array<unknown>
): void => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    const result = hook.callback(message, context, ...extra);
    if (result instanceof Promise) {
      throw new IrisError(
        `@${decorator} hook returned a Promise — ${decorator} hooks must be synchronous`,
      );
    }
  }
};

export const runHooksAsync = async (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  message: unknown,
  context?: unknown,
  ...extra: Array<unknown>
): Promise<void> => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    await hook.callback(message, context, ...extra);
  }
};
