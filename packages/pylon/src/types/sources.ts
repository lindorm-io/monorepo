import { IEntity } from "@lindorm/entity";
import { IKafkaMessageBus, IKafkaSource } from "@lindorm/kafka";
import { IMessage } from "@lindorm/message";
import { IMnemosRepository, IMnemosSource } from "@lindorm/mnemos";
import { IMongoRepository, IMongoSource } from "@lindorm/mongo";
import { IRabbitMessageBus, IRabbitSource } from "@lindorm/rabbit";
import { IRedisMessageBus, IRedisRepository, IRedisSource } from "@lindorm/redis";

export type PylonMessageSource = IKafkaSource | IRabbitSource | IRedisSource;
export type PylonMessageSourceName =
  | IKafkaSource["name"]
  | IRabbitSource["name"]
  | IRedisSource["name"];
export type PylonMessageBus<M extends IMessage> =
  | IKafkaMessageBus<M>
  | IRabbitMessageBus<M>
  | IRedisMessageBus<M>;

export type PylonEntitySource = IMnemosSource | IMongoSource | IRedisSource;
export type PylonEntitySourceName =
  | IMnemosSource["name"]
  | IMongoSource["name"]
  | IRedisSource["name"];
export type PylonEntityRepository<E extends IEntity> =
  | IMnemosRepository<E>
  | IMongoRepository<E>
  | IRedisRepository<E>;

export type PylonSource = PylonMessageSource | PylonEntitySource;
export type PylonSourceName = PylonMessageSourceName | PylonEntitySourceName;
