import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";

export type InheritanceStrategy = "single-table" | "joined";

export type DiscriminatorValue = string | number;

export type MetaInheritance = {
  strategy: InheritanceStrategy;
  discriminatorField: string;
  discriminatorValue: DiscriminatorValue | null; // null for root
  root: Constructor<IEntity>;
  parent: Constructor<IEntity> | null; // null for root
  children: ReadonlyMap<DiscriminatorValue, Constructor<IEntity>>; // discriminator value → constructor
};
