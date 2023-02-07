import { StandardRequestParamsWithId } from "../../standard";

export type InitialiseAuthOidcRequestParams = StandardRequestParamsWithId;

export type InitialiseAuthOidcRequestQuery = {
  provider: string;
  remember?: boolean;
};
