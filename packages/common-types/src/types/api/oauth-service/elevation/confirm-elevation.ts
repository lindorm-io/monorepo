import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmElevationSessionRequestParams = StandardRequestParamsWithId;

export type ConfirmElevationSessionRequestBody = {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  strategies: Array<AuthenticationStrategy>;
};

export type ConfirmElevationResponse = StandardResponseWithRedirectTo;
