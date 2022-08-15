import { ILogger } from "@lindorm-io/winston";
import { LindormError } from "@lindorm-io/errors";
import { MongoViewStore } from "./mongo";
import { PostgresViewStore } from "./postgres";
import { RedisViewStore } from "./redis";
import { View } from "../entity";
import {
  IMessage,
  IView,
  IViewStore,
  ViewIdentifier,
  ViewStoreHandlerOptions,
  ViewStoreOptions,
} from "../types";

export class ViewStore implements IViewStore {
  private readonly custom: IViewStore;
  private readonly mongo: IViewStore;
  private readonly postgres: IViewStore;
  private readonly redis: IViewStore;

  public constructor(options: ViewStoreOptions, logger: ILogger) {
    if (options.custom) {
      this.custom = options.custom;
    }
    if (options.mongo) {
      this.mongo = new MongoViewStore(options.mongo, logger);
    }
    if (options.postgres) {
      this.postgres = new PostgresViewStore(options.postgres, logger);
    }
    if (options.redis) {
      this.redis = new RedisViewStore(options.redis, logger);
    }
  }

  // public

  public save(
    view: IView,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    switch (handlerOptions.type) {
      case "custom":
        if (!this.custom) throw new Error("Connection not provided");
        return this.custom.save(view, causation, handlerOptions);

      case "mongo":
        if (!this.mongo) throw new Error("Connection not provided");
        return this.mongo.save(view, causation, handlerOptions);

      case "postgres":
        if (!this.postgres) throw new Error("Connection not provided");
        return this.postgres.save(view, causation, handlerOptions);

      case "redis":
        if (!this.redis) throw new Error("Connection not provided");
        return this.redis.save(view, causation, handlerOptions);

      default:
        throw new LindormError("Invalid store type");
    }
  }

  public load(identifier: ViewIdentifier, handlerOptions: ViewStoreHandlerOptions): Promise<View> {
    switch (handlerOptions.type) {
      case "custom":
        if (!this.custom) throw new Error("Connection not provided");
        return this.custom.load(identifier, handlerOptions);

      case "mongo":
        if (!this.mongo) throw new Error("Connection not provided");
        return this.mongo.load(identifier, handlerOptions);

      case "postgres":
        if (!this.postgres) throw new Error("Connection not provided");
        return this.postgres.load(identifier, handlerOptions);

      case "redis":
        if (!this.redis) throw new Error("Connection not provided");
        return this.redis.load(identifier, handlerOptions);

      default:
        throw new LindormError("Invalid store type");
    }
  }
}
