import type { MetaHook, MetaHookDecorator } from "../types/metadata";

export const runHooksAsync = async (
  decorator: MetaHookDecorator,
  hooks: Array<MetaHook>,
  entity: unknown,
  context?: unknown,
): Promise<void> => {
  for (const hook of hooks) {
    if (hook.decorator !== decorator) continue;
    await hook.callback(context, entity);
  }
};
