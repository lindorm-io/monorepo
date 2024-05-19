export type SignJwsOptions = {
  contentType?: string;
  objectId?: string;
};

export type SignedJws = {
  objectId: string;
  token: string;
};
