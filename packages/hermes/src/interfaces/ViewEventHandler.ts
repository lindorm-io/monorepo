import { ClassLike, Constructor, Dict } from "@lindorm/types";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ViewEventHandlerAdapter,
  ViewEventHandlerContext,
  ViewEventHandlerFileAggregate,
} from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface IViewEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  event: Constructor<E>;
  adapter: ViewEventHandlerAdapter;
  aggregate?: ViewEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  getViewId?(event: IHermesMessage<E>): string;
  handler(ctx: ViewEventHandlerContext<E, S>): Promise<void>;
}

export interface IHermesViewEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  adapter: ViewEventHandlerAdapter;
  version: number;
  view: HandlerIdentifier;
  getViewId(event: IHermesMessage<E>): string;
  handler(ctx: ViewEventHandlerContext<E, S>): Promise<void>;
}
