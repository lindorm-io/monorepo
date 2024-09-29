import { ClassLike, Constructor, Dict } from "@lindorm/types";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  SagaEventHandlerContext,
  SagaEventHandlerFileAggregate,
} from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface ISagaEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
  D extends ClassLike = ClassLike,
> {
  event: Constructor<E>;
  aggregate?: SagaEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  getSagaId?(event: IHermesMessage<E>): string;
  handler(ctx: SagaEventHandlerContext<E, S, D>): Promise<void>;
}

export interface IHermesSagaEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
  D extends ClassLike = ClassLike,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  version: number;
  getSagaId(event: IHermesMessage<E>): string;
  handler(ctx: SagaEventHandlerContext<E, S, D>): Promise<void>;
}
