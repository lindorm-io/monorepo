export type CweEncryptOptions = {
  objectId?: string;
};

export type EncryptedCwe = {
  buffer: Buffer;
  token: string;
};
