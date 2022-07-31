import { AggregateIdentifier, IAggregate, IEventStore, EventStoreSaveOptions } from "../../types";
import { Command, DomainEvent } from "../../message";
import { EventEntity } from "./entity";
import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { MoreThanOrEqual } from "typeorm";
import { PostgresBase } from "./PostgresBase";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

  public async save(
    aggregate: IAggregate,
    causation: Command,
    options: EventStoreSaveOptions,
  ): Promise<Array<DomainEvent>> {
    await this.promise();

    const { causationEvents, expectedEvents, previousEventId } = options;

    const events = await this.find(
      {
        id: aggregate.id,
        name: aggregate.name,
        context: aggregate.context,
      },
      {
        where: {
          causation_id: causation.id,
        },
      },
    );

    if (events.length) {
      this.logger.debug("Found events matching causation");

      return events;
    }

    await this.connection.transaction(async (manager) => {
      const repository = manager.getRepository(EventEntity);

      let expected_events = expectedEvents;
      let previous_event_id = previousEventId;

      try {
        for (const event of causationEvents) {
          const entity = repository.create({
            id: event.id,
            name: event.name,
            aggregate_id: aggregate.id,
            aggregate_name: aggregate.name,
            aggregate_context: aggregate.context,
            causation_id: event.causationId,
            correlation_id: event.correlationId,
            data: event.data,
            expected_events,
            previous_event_id,
            timestamp: event.timestamp,
          });

          this.logger.debug("Saving entity", { entity });

          const saved = await repository.save(entity);

          this.logger.debug("Saved entity", { saved });

          expected_events += 1;
          previous_event_id = saved.id;
        }
      } catch (err) {
        this.logger.error("Failed to save entity", err);

        throw err;
      }
    });

    this.logger.debug("Aggregate saved");

    return causationEvents;
  }

  public async load(identifier: AggregateIdentifier): Promise<Array<DomainEvent>> {
    await this.promise();

    return await this.find(identifier);
  }

  public async events(from: Date, limit: number): Promise<Array<DomainEvent>> {
    await this.promise();

    const repository = this.connection.getRepository(EventEntity);
    const options: FindManyOptions<EventEntity> = {
      cache: false,
      order: {
        timestamp: "ASC",
      },
      where: {
        timestamp: MoreThanOrEqual(from),
      },
      take: limit,
    };

    this.logger.debug("Querying events", {
      from,
      limit,
      options,
    });

    try {
      const entities = await repository.find(options);

      this.logger.debug("Found events", { entities });

      const array: Array<DomainEvent> = [];
      for (const event of entities) {
        array.push(
          new DomainEvent({
            id: event.id,
            name: event.name,
            aggregate: {
              id: event.aggregate_id,
              name: event.aggregate_name,
              context: event.aggregate_context,
            },
            causationId: event.causation_id,
            correlationId: event.correlation_id,
            data: event.data,
            timestamp: event.timestamp,
          }),
        );
      }

      return array;
    } catch (err) {
      this.logger.error("Failed to query events", err);

      throw err;
    }
  }

  // private

  private async find(
    identifier: AggregateIdentifier,
    options: FindManyOptions<EventEntity> = {},
  ): Promise<Array<DomainEvent>> {
    await this.promise();

    const repository = this.connection.getRepository(EventEntity);
    const filter: FindManyOptions<EventEntity> = {
      cache: false,
      order: {
        expected_events: "ASC",
        ...(options.order || {}),
      },
      where: {
        aggregate_id: identifier.id,
        aggregate_name: identifier.name,
        aggregate_context: identifier.context,
        ...(options.where || {}),
      },
      ...options,
    };

    this.logger.debug("Finding entities", { filter });

    try {
      const events: Array<DomainEvent> = [];
      const entities = await repository.find(filter);

      this.logger.debug("Found entities", { entities });

      for (const entity of entities) {
        events.push(
          new DomainEvent({
            id: entity.id,
            name: entity.name,
            aggregate: {
              id: entity.aggregate_id,
              name: entity.aggregate_name,
              context: entity.aggregate_context,
            },
            causationId: entity.causation_id,
            correlationId: entity.correlation_id,
            data: entity.data,
            timestamp: entity.timestamp,
          }),
        );
      }

      this.logger.debug("Returning array of events", { events });

      return events;
    } catch (err) {
      this.logger.error("Failed to find events", err);

      throw err;
    }
  }
}
