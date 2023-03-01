import { StandardRequestParamsWithId } from "../../standard";

export type UpdateAddressRequestParams = StandardRequestParamsWithId;

export type UpdateAddressRequestBody = {
  careOf: string | null;
  country: string | null;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: Array<string>;
};
