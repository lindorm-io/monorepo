import { EventSource } from "@lindorm-io/event-source";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormEventDomainContext extends DefaultLindormContext {
  eventSource: EventSource;
}

export type DefaultLindormEventDomainKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormEventDomainContext>
>;

export type DefaultLindormEventDomainSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormEventDomainContext>
>;
