import type { Constructor } from "@lindorm/types";

export type SearchPath<E extends Constructor> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;
