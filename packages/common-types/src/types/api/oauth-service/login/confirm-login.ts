import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLoginRequestParams = StandardRequestParamsWithId;

export type ConfirmLoginRequestBody = {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  sso: boolean;
};

export type ConfirmLoginResponse = StandardResponseWithRedirectTo;
