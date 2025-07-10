import { Constructor, Dict } from "@lindorm/types";
import { HandlerIdentifier, SagaTimeoutCallback } from "../types";

export interface ISagaTimeoutHandler<
  C extends Constructor = Constructor,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifier;
  timeout: string;
  saga: HandlerIdentifier;
  handler: SagaTimeoutCallback<C, S>;
}
