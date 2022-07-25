import { EventDomainApp } from "@lindorm-io/event-domain";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormEventDomainContext extends DefaultLindormContext {
  eventDomain: EventDomainApp;
}

export type DefaultLindormEventDomainKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormEventDomainContext>
>;

export type DefaultLindormEventDomainSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormEventDomainContext>
>;
