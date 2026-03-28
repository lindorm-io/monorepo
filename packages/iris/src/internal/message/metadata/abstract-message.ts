import type { Constructor } from "@lindorm/types";

export const ABSTRACT_MESSAGE_KEY = "__abstract";

export const isAbstractMessage = (target: Constructor): boolean => {
  const meta = (target as any)[Symbol.metadata];
  return !!meta && Object.hasOwn(meta, ABSTRACT_MESSAGE_KEY);
};
