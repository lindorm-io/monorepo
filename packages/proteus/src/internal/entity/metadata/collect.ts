import type { StagedMetadata } from "../types/staged.js";

type ElementOf<T> = T extends Array<infer U> ? U : never;

export const collectOwn = <K extends keyof StagedMetadata>(
  target: Function,
  key: K,
): NonNullable<StagedMetadata[K]> | undefined => {
  const meta = (target as any)[Symbol.metadata] as StagedMetadata | undefined;
  if (!meta) return undefined;
  if (!Object.hasOwn(meta, key)) return undefined;
  return meta[key] as NonNullable<StagedMetadata[K]>;
};

export const collectAll = <K extends keyof StagedMetadata>(
  target: Function,
  key: K,
): Array<ElementOf<NonNullable<StagedMetadata[K]>>> => {
  const meta = (target as any)[Symbol.metadata] as StagedMetadata | undefined;
  if (!meta) return [];
  const result: Array<ElementOf<NonNullable<StagedMetadata[K]>>> = [];
  let current: any = meta;
  while (current && current !== Object.prototype && current !== null) {
    if (Object.hasOwn(current, key as string)) {
      const entries = current[key];
      if (Array.isArray(entries)) {
        result.push(...entries);
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return result;
};

export const collectSingular = <K extends keyof StagedMetadata>(
  target: Function,
  key: K,
): NonNullable<StagedMetadata[K]> | undefined => {
  const meta = (target as any)[Symbol.metadata] as StagedMetadata | undefined;
  if (!meta) return undefined;
  return meta[key] as NonNullable<StagedMetadata[K]> | undefined;
};
