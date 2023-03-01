import { StandardRequestParamsWithId } from "../../standard";

export type UpdateIdentifierRequestParams = StandardRequestParamsWithId;

export type UpdateIdentifierRequestBody = {
  label?: string | null;
  primary?: boolean;
};
