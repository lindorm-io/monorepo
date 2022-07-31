import { KoaEventSource } from "./koa-event-source";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormEventDomainContext extends DefaultLindormContext {
  eventSource: KoaEventSource;
}

export type DefaultLindormEventDomainKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormEventDomainContext>
>;

export type DefaultLindormEventDomainSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormEventDomainContext>
>;
