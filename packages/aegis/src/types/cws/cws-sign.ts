export type SignCwsOptions = {
  contentType?: string;
  objectId?: string;
};

export type SignedCws = {
  buffer: Buffer;
  objectId: string;
  token: string;
};
