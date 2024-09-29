import { IRabbitMessage } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { AggregateIdentifier } from "../types";

export interface IHermesMessage<D extends Dict = Dict, M extends Dict = Dict>
  extends IRabbitMessage {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  data: D;
  meta: M;
  name: string;
  version: number;
}
