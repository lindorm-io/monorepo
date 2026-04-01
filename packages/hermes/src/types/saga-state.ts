import type { Dict } from "@lindorm/types";

export type SagaState<S extends Dict = Dict> = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  messagesToDispatch: Array<unknown>;
  revision: number;
  state: S;
  createdAt: Date;
  updatedAt: Date;
};
