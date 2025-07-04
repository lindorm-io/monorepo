import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";

export type GetIncrementFn = (key: string) => Promise<number>;

export type EntityKitOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  logger?: ILogger;
  source: string;
  getNextIncrement?: GetIncrementFn;
};

export type NamespaceOptions = {
  namespace?: string | null;
};

export type SaveStrategy = "insert" | "update" | "unknown";

export type UpdateStrategy = "update" | "version";
