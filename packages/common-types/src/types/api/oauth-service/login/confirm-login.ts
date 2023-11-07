import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLoginRequestParams = StandardRequestParamsWithId;

export type ConfirmLoginRequestBody = {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  singleSignOn: boolean;
  strategies: Array<AuthenticationStrategy>;
};

export type ConfirmLoginResponse = StandardResponseWithRedirectTo;
