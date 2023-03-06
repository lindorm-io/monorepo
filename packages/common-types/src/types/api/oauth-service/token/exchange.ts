export type TokenExchangeRequestBody = {
  token: string;
};

export type TokenExchangeResponseBody = {
  jwt: string;
  expiresIn: number;
};
