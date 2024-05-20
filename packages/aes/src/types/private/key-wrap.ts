import { IKryptos } from "@lindorm/kryptos";

export type KeyWrapOptions = {
  contentEncryptionKey: Buffer;
  keyEncryptionKey: Buffer;
  kryptos: IKryptos;
};

export type KeyWrapResult = {
  publicEncryptionIv?: Buffer;
  publicEncryptionKey: Buffer;
  publicEncryptionTag?: Buffer;
};

export type KeyUnwrapOptions = {
  keyEncryptionKey: Buffer;
  kryptos: IKryptos;
  publicEncryptionIv?: Buffer;
  publicEncryptionKey: Buffer;
  publicEncryptionTag?: Buffer;
};

export type KeyUnwrapResult = {
  contentEncryptionKey: Buffer;
};
