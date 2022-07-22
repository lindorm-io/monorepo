import { Logger } from "@lindorm-io/winston";
import { AmqpConnection } from "@lindorm-io/amqp";
import { MongoConnection } from "@lindorm-io/mongo";

export interface AppDomain {
  directory?: string;
  context?: string;
}

export interface AppStructure {
  directory: string;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
  extensions?: Array<string>;
}

export interface AppOptions {
  aggregates?: AppStructure;
  dangerouslyRegisterHandlersManually?: boolean;
  domain?: AppDomain;
  require?: NodeJS.Require;
  sagas?: AppStructure;
  views?: AppStructure;
}

export interface EventDomainAppOptions extends AppOptions {
  amqp: AmqpConnection;
  database?: string;
  logger: Logger;
  mongo: MongoConnection;
}

export interface PublishCommandOptions {
  aggregate: {
    id: string;
    name: string;
    context?: string;
  };
  name: string;
  data: Record<string, any>;
  delay?: number;
  mandatory?: boolean;
}
