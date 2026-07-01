import type { Dict } from "@lindorm/types";

export const getHandshakeHeader =
  (headers: Dict<string | string[] | undefined> | undefined) =>
  (name: string): string | undefined => {
    const value = headers?.[name];
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  };
