import type { Dict } from "@lindorm/types";

export type SagaDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};
