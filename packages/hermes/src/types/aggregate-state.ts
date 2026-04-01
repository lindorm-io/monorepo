import type { Dict } from "@lindorm/types";

export type AggregateState<S extends Dict = Dict> = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  events: Array<{
    id: string;
    name: string;
    version: number;
    data: Dict;
    meta: Dict;
    causationId: string;
    correlationId: string | null;
    timestamp: Date;
  }>;
  numberOfLoadedEvents: number;
  state: S;
};
