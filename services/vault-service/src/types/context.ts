import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { Controller } from "@lindorm-io/koa";
import {
  LindormNodeServerAxios,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerMemory,
  LindormNodeServerMongo,
  LindormNodeServerRedis,
} from "@lindorm-io/node-server";
import { EncryptedRecord, ProtectedRecord } from "../entity";
import {
  EncryptedRecordRepository,
  EncryptionKeyRepository,
  ProtectedRecordRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  oauthClient: Axios;
}

interface ServerEntity {
  encryptedRecord: EncryptedRecord;
  protectedRecord: ProtectedRecord;
}

interface ServerMongo extends LindormNodeServerMongo {
  encryptedRecordRepository: EncryptedRecordRepository;
  encryptionKeyRepository: EncryptionKeyRepository;
  protectedRecordRepository: ProtectedRecordRepository;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: LindormNodeServerRedis;
}

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<Context, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}
