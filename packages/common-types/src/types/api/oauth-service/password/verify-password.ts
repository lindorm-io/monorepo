import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "../../../auth";

export type VerifyPasswordRequestBody = {
  username: string;
  password: string;
};

export type VerifyPasswordResponse = {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  strategies: Array<AuthenticationStrategy>;
};
