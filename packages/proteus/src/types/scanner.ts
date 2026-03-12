import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";

/**
 * Accepted input for entity registration.
 *
 * Each element is either an entity constructor or a glob pattern string
 * that resolves to modules exporting entity classes.
 */
export type EntityScannerInput<T extends IEntity = IEntity> = Array<
  Constructor<T> | string
>;
