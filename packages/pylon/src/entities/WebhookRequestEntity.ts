import { Column, Entity, Index, PrimarySource } from "@lindorm/entity";
import { Dict } from "@lindorm/types";
import { IWebhookRequestEntity } from "../interfaces";
import { QueueableEntity } from "./QueueableEntity";

export abstract class WebhookRequestEntity
  extends QueueableEntity
  implements IWebhookRequestEntity
{
  @Index()
  @Column("string")
  public readonly event!: string;

  @Column("object")
  public readonly payload!: Dict;
}

@Entity()
@PrimarySource("MnemosSource")
export class MnemosWebhookRequestEntity extends WebhookRequestEntity {}

@Entity()
@PrimarySource("MongoSource")
export class MongoWebhookRequestEntity extends WebhookRequestEntity {}

@Entity()
@PrimarySource("RedisSource")
export class RedisWebhookRequestEntity extends WebhookRequestEntity {}
