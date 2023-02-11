import { OpenIdClaims } from "../../open-id";
import { StandardRequestParamsWithId } from "../standard";

export type AddUserinfoRequestParams = StandardRequestParamsWithId;

export type AddUserinfoRequestBody = Partial<Omit<OpenIdClaims, "sub">> &
  Pick<OpenIdClaims, "sub"> & { provider: string };
