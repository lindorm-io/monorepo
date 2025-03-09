import "reflect-metadata";
import { CreateDateColumn, PrimaryKeyColumn } from "../decorators";
import { IEntityBase } from "../interfaces";

export abstract class EntityBase implements IEntityBase {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @CreateDateColumn()
  public readonly createdAt!: Date;
}
