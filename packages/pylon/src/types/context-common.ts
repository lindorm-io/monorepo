import { IAegis, ParsedCws, ParsedCwt, ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { IEntity } from "@lindorm/entity";
import { IHermes } from "@lindorm/hermes";
import { IKafkaPublisher, IKafkaSource } from "@lindorm/kafka";
import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Middleware } from "@lindorm/middleware";
import { IMnemosRepository, IMnemosSource } from "@lindorm/mnemos";
import { IMongoRepository, IMongoSource } from "@lindorm/mongo";
import { IRabbitPublisher, IRabbitSource } from "@lindorm/rabbit";
import { IRedisPublisher, IRedisRepository, IRedisSource } from "@lindorm/redis";
import { Dict, Environment, Priority } from "@lindorm/types";
import { AuthorizationState } from "./authorization";
import { IoServer } from "./socket";

export type AppState = {
  domain: string;
  environment: Environment;
  name: string;
  version: string;
};

export type PylonMetadata = {
  id: string;
  correlationId: string;
  date: Date;
  environment: Environment;
};

export type PylonHttpMetadata = PylonMetadata & {
  responseId: string;
  sessionId: string | null;
  origin: string | null;
};

export type PylonState = {
  app: AppState;
  authorization: AuthorizationState;
  metadata: PylonMetadata;
  tokens: Dict<ParsedJwt | ParsedJws<any> | ParsedCwt | ParsedCws<any>>;
};

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

export type PylonCommonContext = {
  aegis: IAegis;
  amphora: IAmphora;
  conduits: Conduits;
  entities: Dict<IEntity>;
  logger: ILogger;

  hermes?: IHermes;

  kafka?: {
    source: IKafkaSource;
    publishers: Dict<IKafkaPublisher<IMessage>>;
  };
  mnemos?: {
    source: IMnemosSource;
    repositories: Dict<IMnemosRepository<IEntity>>;
  };
  mongo?: {
    source: IMongoSource;
    repositories: Dict<IMongoRepository<IEntity>>;
  };
  rabbit?: {
    source: IRabbitSource;
    publishers: Dict<IRabbitPublisher<IMessage>>;
  };
  redis?: {
    source: IRedisSource;
    publishers: Dict<IRedisPublisher<IMessage>>;
    repositories: Dict<IRedisRepository<IEntity>>;
  };

  queue: (
    event: string,
    payload: Dict,
    priority?: Priority,
    optional?: boolean,
  ) => Promise<void>;
  webhook: (event: string, data?: any, optional?: boolean) => Promise<void>;
};

export type PylonContext = PylonCommonContext & {
  data: any;
  io: IoServer;
  params: Dict<string>;
  state: PylonState;
};

export type PylonMiddleware<C extends PylonContext = PylonContext> = Middleware<C>;
