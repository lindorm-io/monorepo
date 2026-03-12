import type { Constructor } from "@lindorm/types";
import type { IEntity, IProteusRepository } from "../../interfaces";

export type RepositoryFactory = <C extends IEntity>(
  target: Constructor<C>,
  parent?: Constructor<IEntity>,
) => IProteusRepository<C>;
