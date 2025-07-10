import { IMessageBase } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { AggregateIdentifier } from "../types";

export interface IHermesMessage<D = Dict, M extends Dict = Dict> extends IMessageBase {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  data: D;
  delay: number;
  mandatory: boolean;
  meta: M;
  name: string;
  version: number;
}
