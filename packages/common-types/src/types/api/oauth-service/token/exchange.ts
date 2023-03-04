export type TokenExchangeRequestBody = {
  token: string;
};

export type TokenExchangeResponseBody = {
  token: string;
  expiresIn: number;
};
