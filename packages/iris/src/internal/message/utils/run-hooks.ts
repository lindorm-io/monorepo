import { IrisError } from "../../../errors/IrisError.js";
import type { IrisHookMeta } from "../../../types/iris-hook-meta.js";
import type { MetaHook } from "../types/metadata.js";
import type { MetaHookDecorator } from "../types/types.js";

export const runHooksSync = (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  message: unknown,
  meta: IrisHookMeta,
  ...extra: Array<unknown>
): void => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    const result = hook.callback(message, meta, ...extra);
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
  meta: IrisHookMeta,
  ...extra: Array<unknown>
): Promise<void> => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    await hook.callback(message, meta, ...extra);
  }
};
