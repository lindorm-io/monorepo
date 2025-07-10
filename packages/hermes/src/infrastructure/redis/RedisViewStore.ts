import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IRedisSource } from "@lindorm/redis";
import { IViewStore } from "../../interfaces";
import {
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../../types";
import { RedisBase } from "./RedisBase";

export class RedisViewStore extends RedisBase implements IViewStore {
  public constructor(source: IRedisSource, logger: ILogger) {
    super(source, logger);
  }

  public async findCausationIds(viewIdentifier: ViewIdentifier): Promise<Array<string>> {
    this.logger.debug("Finding causation ids", { viewIdentifier });

    try {
      await this.promise();

      const key = this.causationKey(viewIdentifier);
      const result = await this.source.client.get(key);
      const json = result ? JSON.parse(result) : [];

      this.logger.debug("Found causation ids", { causationIds: json });

      return json;
    } catch (err: any) {
      this.logger.error("Failed to find causation ids", err);

      throw err;
    }
  }

  public async findView(
    viewIdentifier: ViewIdentifier,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { viewIdentifier });

    try {
      await this.promise();

      const key = this.redisKey(viewIdentifier);
      const result = await this.source.client.get(key);

      if (!result) {
        this.logger.debug("View not found", { viewIdentifier });

        return;
      }

      const data = JsonKit.parse(result);

      this.logger.debug("Found view", { data });

      return {
        id: data.id,
        name: data.name,
        namespace: data.namespace,
        destroyed: data.destroyed,
        meta: data.meta,
        processed_causation_ids: data.processed_causation_ids,
        revision: data.revision,
        state: data.state,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err: any) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async insertCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting causation ids", {
      viewIdentifier,
      causationIds,
    });

    try {
      await this.promise();

      const key = this.causationKey(viewIdentifier);
      const result = await this.source.client.get(key);
      const json = result ? JSON.parse(result) : [];
      const unique = [...new Set([...json, ...causationIds])];

      await this.source.client.set(key, JSON.stringify(unique));

      this.logger.debug("Inserted processed causation ids", {
        viewIdentifier,
        causationIds,
      });
    } catch (err: any) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async insertView(attributes: ViewStoreAttributes): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      await this.promise();

      const result = await this.source.client.get(this.redisKey(attributes));

      if (result) {
        throw new Error("View already exists");
      }

      await this.source.client.set(
        this.redisKey(attributes),
        JsonKit.stringify(attributes),
      );

      this.logger.debug("Inserted view", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async updateView(
    filter: ViewUpdateFilter,
    data: ViewUpdateAttributes,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      await this.promise();

      const key = this.redisKey(filter);
      const result = await this.source.client.get(key);
      const parsed = JsonKit.parse(result);

      if (parsed.revision !== filter.revision) {
        throw new Error("Revision mismatch");
      }

      const updated = JsonKit.stringify({
        ...parsed,
        ...data,
      });

      await this.source.client.set(key, updated);

      this.logger.debug("Updated view", { filter, data });
    } catch (err: any) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }

  // private

  private redisKey(viewIdentifier: ViewIdentifier): string {
    return `view:${viewIdentifier.namespace}:${viewIdentifier.name}:${viewIdentifier.id}`;
  }

  private causationKey(viewIdentifier: ViewIdentifier): string {
    return `causation:${viewIdentifier.namespace}:${viewIdentifier.name}:${viewIdentifier.id}`;
  }
}
