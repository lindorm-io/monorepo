export type OpenIdResponseType =
  | "code"
  | "token"
  | "id_token"
  | "code id_token"
  | "code token"
  | "id_token token"
  | "code id_token token"
  | "none"
  | (string & {});
