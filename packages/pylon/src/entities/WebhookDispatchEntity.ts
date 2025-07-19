import { Column, Entity, Index, PrimarySource } from "@lindorm/entity";
import { Dict } from "@lindorm/types";
import { IWebhookDispatchEntity, IWebhookSubscription } from "../interfaces";
import { QueueableEntity } from "./QueueableEntity";

export abstract class WebhookDispatchEntity
  extends QueueableEntity
  implements IWebhookDispatchEntity
{
  @Index()
  @Column("string")
  public readonly event!: string;

  @Column("object")
  public readonly payload!: Dict;

  @Column("object")
  public readonly subscription!: IWebhookSubscription;
}

@Entity()
@PrimarySource("MnemosSource")
export class MnemosWebhookDispatchEntity extends WebhookDispatchEntity {}

@Entity()
@PrimarySource("MongoSource")
export class MongoWebhookDispatchEntity extends WebhookDispatchEntity {}

@Entity()
@PrimarySource("RedisSource")
export class RedisWebhookDispatchEntity extends WebhookDispatchEntity {}
