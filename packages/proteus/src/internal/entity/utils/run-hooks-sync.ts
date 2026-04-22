import { ProteusError } from "../../../errors/index.js";
import type { ProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import { createDefaultProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import type { MetaHook, MetaHookDecorator } from "../types/metadata.js";

export const runHooksSync = (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  entity: unknown,
  context?: ProteusHookMeta,
): void => {
  const meta = context ?? createDefaultProteusHookMeta();
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    const result = hook.callback(entity, meta);
    if (result instanceof Promise) {
      throw new ProteusError(
        `@${decorator} hook returned a Promise — ${decorator} hooks must be synchronous. ` +
          `Use @AfterLoad for async post-load enrichment.`,
      );
    }
  }
};
