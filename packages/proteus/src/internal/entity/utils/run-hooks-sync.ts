import { ProteusError } from "../../../errors";
import type { MetaHook, MetaHookDecorator } from "../types/metadata";

export const runHooksSync = (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  entity: unknown,
  context?: unknown,
): void => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    const result = hook.callback(context, entity);
    if (result instanceof Promise) {
      throw new ProteusError(
        `@${decorator} hook returned a Promise — ${decorator} hooks must be synchronous. ` +
          `Use @AfterLoad for async post-load enrichment.`,
      );
    }
  }
};
