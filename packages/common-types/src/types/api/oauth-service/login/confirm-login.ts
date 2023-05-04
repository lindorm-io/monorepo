import { AuthenticationMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLoginRequestParams = StandardRequestParamsWithId;

export type ConfirmLoginRequestBody = {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  singleSignOn: boolean;
};

export type ConfirmLoginResponse = StandardResponseWithRedirectTo;
