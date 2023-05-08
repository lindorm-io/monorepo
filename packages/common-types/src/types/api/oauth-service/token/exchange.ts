export type TokenExchangeRequestBody = {
  token: string;
};

export type TokenExchangeResponseBody = {
  expiresIn: number;
  token: string;
};
