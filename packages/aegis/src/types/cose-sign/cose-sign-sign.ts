export type SignCoseSignOptions = {
  contentType?: string;
  objectId?: string;
};

export type SignedCoseSign = {
  buffer: Buffer;
  objectId: string;
  token: string;
};
