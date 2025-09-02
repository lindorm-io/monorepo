import { IEntity } from "@lindorm/entity";
import { IKafkaMessageBus, IKafkaSource } from "@lindorm/kafka";
import { IMessage } from "@lindorm/message";
import { IMnemosRepository, IMnemosSource } from "@lindorm/mnemos";
import { IMongoRepository, IMongoSource } from "@lindorm/mongo";
import { IRabbitMessageBus, IRabbitSource } from "@lindorm/rabbit";
import { IRedisMessageBus, IRedisRepository, IRedisSource } from "@lindorm/redis";

export type PylonMessageSource = IKafkaSource | IRabbitSource | IRedisSource;
export type PylonMessageSourceName =
  | IKafkaSource["__instanceof"]
  | IRabbitSource["__instanceof"]
  | IRedisSource["__instanceof"];
export type PylonMessageBus<M extends IMessage> =
  | IKafkaMessageBus<M>
  | IRabbitMessageBus<M>
  | IRedisMessageBus<M>;

export type PylonEntitySource = IMnemosSource | IMongoSource | IRedisSource;
export type PylonEntitySourceName =
  | IMnemosSource["__instanceof"]
  | IMongoSource["__instanceof"]
  | IRedisSource["__instanceof"];
export type PylonEntityRepository<E extends IEntity> =
  | IMnemosRepository<E>
  | IMongoRepository<E>
  | IRedisRepository<E>;

export type PylonSource = PylonMessageSource | PylonEntitySource;
export type PylonSourceName = PylonMessageSourceName | PylonEntitySourceName;
