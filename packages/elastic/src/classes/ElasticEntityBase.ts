import { EntityBase } from "@lindorm/entity";
import { IElasticEntity } from "../interfaces";

export class ElasticEntityBase extends EntityBase implements IElasticEntity {
  public readonly primaryTerm: number;

  public constructor(options: Partial<IElasticEntity> = {}) {
    super(options);
    this.primaryTerm = options.primaryTerm ?? 0;
  }
}
