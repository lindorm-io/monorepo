import { AuthenticationMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmElevationRequestParams = StandardRequestParamsWithId;

export type ConfirmElevationRequestBody = {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
};

export type ConfirmElevationResponse = StandardResponseWithRedirectTo;
