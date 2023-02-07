import { OpenIdClaims } from "../../open-id";
import { StandardRequestParamsWithId } from "../standard";

export type AddUserinfoRequestParams = StandardRequestParamsWithId;

export type AddUserinfoRequestBody = Partial<OpenIdClaims> & { provider: string };
