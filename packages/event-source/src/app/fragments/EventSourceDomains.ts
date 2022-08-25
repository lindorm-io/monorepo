import { AggregateDomain, ReplayDomain, SagaDomain, ViewDomain } from "../../domain";
import { EventSourceStores } from "./EventSourceStores";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import {
  IAggregateDomain,
  IReplayDomain,
  ISagaDomain,
  IViewDomain,
  PrivateAppOptions,
} from "../../types";

export class EventSourceDomains {
  public readonly aggregate: IAggregateDomain;
  public readonly saga: ISagaDomain;
  public readonly replay: IReplayDomain;
  public readonly view: IViewDomain;

  public constructor(
    options: PrivateAppOptions,
    stores: EventSourceStores,
    messageBus: IMessageBus,
    logger: ILogger,
  ) {
    this.aggregate = new AggregateDomain(
      {
        messageBus,
        store: stores.event,
      },
      logger,
    );
    this.saga = new SagaDomain(
      {
        messageBus,
        store: stores.saga,
      },
      logger,
    );
    this.replay = new ReplayDomain({
      messageBus,
      logger,
      eventStore: stores.event,
      context: options.context,
    });
    this.view = new ViewDomain(
      {
        messageBus,
        store: stores.view,
      },
      logger,
    );
  }
}
