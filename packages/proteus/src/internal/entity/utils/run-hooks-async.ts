import type { ProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import { createDefaultProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import type { MetaHook, MetaHookDecorator } from "../types/metadata.js";

export const runHooksAsync = async (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  entity: unknown,
  context?: ProteusHookMeta,
): Promise<void> => {
  const meta = context ?? createDefaultProteusHookMeta();
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    await hook.callback(entity, meta);
  }
};
