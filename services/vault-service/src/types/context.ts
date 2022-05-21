import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { EncryptedRecord, ProtectedRecord } from "../entity";
import { EncryptedRecordRepository, ProtectedRecordRepository } from "../infrastructure";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
} from "@lindorm-io/node-server";

interface ServerAxios extends LindormNodeServerAxios {
  oauthClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  [key: string]: any; // TODO: FIX
}

interface ServerEntity {
  encryptedRecord: EncryptedRecord;
  protectedRecord: ProtectedRecord;
}

interface ServerRepository extends LindormNodeServerRepository {
  encryptedRecordRepository: EncryptedRecordRepository;
  protectedRecordRepository: ProtectedRecordRepository;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
