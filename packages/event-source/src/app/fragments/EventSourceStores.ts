import { EventStore, SagaStore, ViewEntity, ViewStore } from "../../infrastructure";
import { EventSourceConnections } from "./EventSourceConnections";
import { ILogger } from "@lindorm-io/winston";
import {
  AppCustomOptions,
  HandlerIdentifier,
  IDomainEventStore,
  IDomainSagaStore,
  IDomainViewStore,
  MongoIndex,
  PrivateAppOptions,
} from "../../types";

export class EventSourceStores {
  public readonly event: IDomainEventStore;
  public readonly saga: IDomainSagaStore;
  public readonly view: IDomainViewStore;

  public readonly viewEntities: Record<string, typeof ViewEntity>;
  public readonly viewIndices: Record<
    string,
    { collection?: string; indices?: Array<MongoIndex>; view: HandlerIdentifier }
  >;

  public constructor(
    options: PrivateAppOptions,
    custom: AppCustomOptions,
    connections: EventSourceConnections,
    logger: ILogger,
  ) {
    this.event = new EventStore(
      {
        custom: custom.eventStore,
        mongo: connections.mongo,
        postgres: connections.postgres,
        type: options.adapters.eventStore,
      },
      logger,
    );
    this.saga = new SagaStore(
      {
        custom: custom.sagaStore,
        mongo: connections.mongo,
        postgres: connections.postgres,
        type: options.adapters.sagaStore,
      },
      logger,
    );
    this.view = new ViewStore(
      {
        custom: custom.viewStore,
        mongo: connections.mongo,
        postgres: connections.postgres,
        type: options.adapters.viewStore,
      },
      logger,
    );

    this.viewEntities = {};
    this.viewIndices = {};
  }

  public async initialise(): Promise<void> {
    await this.event.initialise();
    await this.saga.initialise();
    await this.view.initialise(Object.values(this.viewIndices).map((item) => item));
  }
}
