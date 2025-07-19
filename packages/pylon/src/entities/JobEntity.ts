import { Column, Entity, Index, PrimarySource } from "@lindorm/entity";
import { Dict } from "@lindorm/types";
import { IJobEntity } from "../interfaces/Job";
import { QueueableEntity } from "./QueueableEntity";

export abstract class JobEntity extends QueueableEntity implements IJobEntity {
  @Index()
  @Column("string")
  public readonly event!: string;

  @Column("object")
  public readonly payload!: Dict;
}

@Entity()
@PrimarySource("MnemosSource")
export class MnemosJobEntity extends JobEntity {}

@Entity()
@PrimarySource("MongoSource")
export class MongoJobEntity extends JobEntity {}

@Entity()
@PrimarySource("RedisSource")
export class RedisJobEntity extends JobEntity {}
