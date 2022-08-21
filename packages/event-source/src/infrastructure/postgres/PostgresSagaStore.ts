import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { SagaCausationEntity, SagaEntity } from "./entity";
import {
  IMessage,
  ISagaStore,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
  StandardIdentifier,
} from "../../types";

export class PostgresSagaStore extends PostgresBase implements ISagaStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
  }

  public async causationExists(
    identifier: StandardIdentifier,
    causation: IMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    try {
      const result = await this.connection.getRepository(SagaCausationEntity).findOneBy({
        saga_id: identifier.id,
        saga_name: identifier.name,
        saga_context: identifier.context,
        causation_id: causation.id,
      });

      return !!result;
    } catch (err) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    this.logger.debug("Clearing messages", { filter, data });

    try {
      const result = await this.connection.getRepository(SagaEntity).update(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          revision: filter.revision,
          hash: filter.hash,
        },
        {
          hash: data.hash,
          messages_to_dispatch: data.messages_to_dispatch,
          revision: data.revision,
        },
      );

      this.logger.debug("Cleared messages", { result });
    } catch (err) {
      this.logger.error("Failed to clear messages", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      const result = await this.connection.getRepository(SagaEntity).update(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          hash: data.hash,
          processed_causation_ids: data.processed_causation_ids,
          revision: data.revision,
        },
      );

      this.logger.debug("Cleared processed causation ids", { result });
    } catch (err) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(identifier: StandardIdentifier): Promise<SagaStoreAttributes> {
    this.logger.debug("Finding saga", { identifier });

    try {
      const result = await this.connection.getRepository(SagaEntity).findOneBy({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
      });

      if (!result) {
        this.logger.debug("Saga not found");

        return;
      }

      this.logger.debug("Found saga", { result });

      return result;
    } catch (err) {
      this.logger.error("Failed to find saga", err);

      throw err;
    }
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    this.logger.debug("Inserting saga", { attributes });

    try {
      const result = await this.connection.getRepository(SagaEntity).insert(attributes);

      this.logger.debug("Inserted saga", { result });
    } catch (err) {
      this.logger.error("Failed to insert saga", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    identifier: StandardIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { identifier, causationIds });

    try {
      const result = await this.connection.client
        .createQueryBuilder()
        .insert()
        .into(SagaCausationEntity)
        .values(
          causationIds.map((causationId) => ({
            saga_id: identifier.id,
            saga_name: identifier.name,
            saga_context: identifier.context,
            causation_id: causationId,
          })),
        )
        .execute();

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  public async update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

    try {
      const result = await this.connection.getRepository(SagaEntity).update(
        {
          id: filter.id,
          name: filter.name,
          context: filter.context,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          destroyed: data.destroyed,
          hash: data.hash,
          messages_to_dispatch: data.messages_to_dispatch,
          processed_causation_ids: data.processed_causation_ids,
          revision: data.revision,
          state: data.state,
        },
      );

      this.logger.debug("Updated saga", { result });
    } catch (err) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }
}
