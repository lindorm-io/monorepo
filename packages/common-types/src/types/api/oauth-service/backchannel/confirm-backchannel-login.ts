import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmBackchannelLoginRequestParams = StandardRequestParamsWithId;

export type ConfirmBackchannelLoginRequestBody = {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  singleSignOn: boolean;
  strategies: Array<AuthenticationStrategy>;
};
