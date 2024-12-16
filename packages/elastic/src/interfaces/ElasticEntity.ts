import { IEntity } from "@lindorm/entity";

export interface IElasticEntity extends IEntity {
  primaryTerm: number;
}
