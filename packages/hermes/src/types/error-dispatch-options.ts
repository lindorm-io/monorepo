import type { Dict } from "@lindorm/types";

export type ErrorDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};
