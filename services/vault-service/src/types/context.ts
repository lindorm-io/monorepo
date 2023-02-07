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

type ServerAxios = LindormNodeServerAxios & {
  oauthClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  [key: string]: any; // TODO: FIX
};

type ServerEntity = {
  encryptedRecord: EncryptedRecord;
  protectedRecord: ProtectedRecord;
};

type ServerRepository = LindormNodeServerRepository & {
  encryptedRecordRepository: EncryptedRecordRepository;
  protectedRecordRepository: ProtectedRecordRepository;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
};

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
