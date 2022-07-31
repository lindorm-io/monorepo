import { ILogger } from "@lindorm-io/winston";
import { IRedisConnection } from "@lindorm-io/redis";
import { RedisBase } from "./RedisBase";
import { RedisIndex } from "./RedisIndex";
import { View } from "../../entity";
import { ViewNotSavedError, ViewNotUpdatedError } from "../../error";
import { difference, find, snakeCase } from "lodash";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  IMessage,
  IView,
  IViewStore,
  RedisViewStoreAttributes,
  ViewData,
  ViewIdentifier,
  ViewStoreHandlerOptions,
} from "../../types";

export class RedisViewStore extends RedisBase implements IViewStore {
  private readonly index: RedisIndex;

  public constructor(connection: IRedisConnection, logger: ILogger) {
    super({ connection }, logger);

    this.index = new RedisIndex(this.connection, this.logger);
  }

  // public

  public async save(
    view: IView,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    const json = view.toJSON();

    this.logger.debug("Saving View", {
      view: json,
      causation,
      handlerOptions,
    });

    const existing = await this.find(json);

    if (existing && find(existing.causationList, causation.id)) {
      this.logger.debug("Found existing view matching causation", { view: existing.toJSON() });

      return existing;
    }

    if (existing && json.revision === 0) {
      throw new ViewNotSavedError("View revision is 0 while existing view in store");
    }

    if (json.revision === 0) {
      return await this.insert(json, causation, handlerOptions);
    }

    return await this.update(json, causation, handlerOptions);
  }

  public async load(
    identifier: ViewIdentifier,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    this.logger.debug("Loading view", { identifier, handlerOptions });

    const existing = await this.find(identifier);

    if (existing) {
      this.logger.debug("Loading existing view", { view: existing.toJSON() });

      return existing;
    }

    const view = new View(identifier, this.logger);

    this.logger.debug("Loading ephemeral view", { view: view.toJSON() });

    return view;
  }

  // private

  private async find(identifier: ViewIdentifier): Promise<View | undefined> {
    await this.promise();

    this.logger.debug("Finding view", { identifier });

    try {
      const key = RedisViewStore.getKey(identifier);
      const blob = await this.connection.client.get(key);

      if (!blob) {
        this.logger.debug("View not found");
        return;
      }

      const result = parseBlob<RedisViewStoreAttributes>(blob);

      this.logger.debug("Found view document", { result });

      return new View(
        {
          id: result.id,
          name: result.name,
          context: result.context,
          causationList: result.causation_list,
          destroyed: result.destroyed,
          meta: result.meta,
          revision: result.revision,
          state: result.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  private async insert(
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    await this.promise();

    this.logger.debug("Inserting view", {
      view,
      causation,
      handlerOptions,
    });

    try {
      const key = RedisViewStore.getKey(view);
      const blob = stringifyBlob<RedisViewStoreAttributes>({
        id: view.id,
        name: view.name,
        context: view.context,
        causation_list: [causation.id],
        destroyed: view.destroyed,
        meta: view.meta,
        revision: view.revision + 1,
        state: view.state,
        timestamp_created: new Date(),
        timestamp_modified: new Date(),
      });

      let result: string | null;
      if (handlerOptions.redis?.expiration) {
        result = await this.connection.client.setex(key, handlerOptions.redis?.expiration, blob);
      } else {
        result = await this.connection.client.set(key, blob);
      }

      await this.index.push(view);

      this.logger.debug("Saved view", {
        key,
        blob,
        result,
      });

      return new View(
        {
          ...view,
          causationList: [causation.id],
          revision: view.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  private async update(
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    await this.promise();

    this.logger.debug("Updating view", {
      view,
      causation,
      handlerOptions,
    });

    const attributes = await this.findVerifiedView(view);
    const causationList =
      handlerOptions.redis?.causationsCap && handlerOptions.redis?.causationsCap > 0
        ? [...view.causationList, causation.id].slice(handlerOptions.redis.causationsCap * -1)
        : [...view.causationList, causation.id];

    try {
      const key = RedisViewStore.getKey(view);
      const blob = stringifyBlob<RedisViewStoreAttributes>({
        id: view.id,
        name: view.name,
        context: view.context,
        causation_list: causationList,
        destroyed: view.destroyed,
        meta: view.meta,
        revision: view.revision + 1,
        state: view.state,
        timestamp_created: attributes.timestamp_created,
        timestamp_modified: new Date(),
      });

      let result: string | null;
      if (handlerOptions.redis?.expiration) {
        result = await this.connection.client.setex(key, handlerOptions.redis?.expiration, blob);
      } else {
        result = await this.connection.client.set(key, blob);
      }

      if (result !== "OK") {
        throw new ViewNotUpdatedError("Client failed to set document");
      }

      this.logger.debug("Updated view document", {
        key,
        blob,
        result,
      });

      return new View(
        {
          ...view,
          causationList,
          revision: view.revision + 1,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }

  private async findVerifiedView(view: ViewData): Promise<RedisViewStoreAttributes> {
    await this.promise();

    try {
      const key = RedisViewStore.getKey(view);
      const result = await this.connection.client.get(key);

      if (!result) {
        throw new ViewNotUpdatedError("Document not found");
      }

      const attributes = parseBlob<RedisViewStoreAttributes>(result);

      if (attributes.revision !== view.revision) {
        throw new ViewNotUpdatedError("Incorrect document revision");
      }

      const diff = difference(view.causationList, attributes.causation_list);

      if (diff.length) {
        throw new ViewNotUpdatedError("Incorrect causation list");
      }

      this.logger.debug("Asserted view revision", {
        causationList: view.causationList,
        diff,
        key,
        revision: view.revision,
      });

      return attributes;
    } catch (err) {
      this.logger.debug("Failed to assert view data", err);

      throw err;
    }
  }

  // static

  public static getKey(viewIdentifier: ViewIdentifier): string {
    return `${snakeCase(viewIdentifier.context)}::${snakeCase(viewIdentifier.name)}::item::${
      viewIdentifier.id
    }`;
  }
}
