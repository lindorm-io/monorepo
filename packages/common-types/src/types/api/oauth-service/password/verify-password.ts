import { AuthenticationMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";

export type VerifyPasswordRequestBody = {
  username: string;
  password: string;
};

export type VerifyPasswordResponse = {
  identityId: string;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  nonce: string;
};
