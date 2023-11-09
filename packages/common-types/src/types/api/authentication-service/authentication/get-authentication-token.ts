import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "../../../auth";

export type GetAuthenticationTokenQuery = {
  session: string;
};

export type GetAuthenticationTokenResponse = {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  strategies: Array<AuthenticationStrategy>;
};
