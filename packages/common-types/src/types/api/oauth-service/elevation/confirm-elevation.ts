import { AuthenticationMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmElevationSessionRequestParams = StandardRequestParamsWithId;

export type ConfirmElevationSessionRequestBody = {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
};

export type ConfirmElevationResponse = StandardResponseWithRedirectTo;
