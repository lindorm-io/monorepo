import { AuthenticationMethod } from "@lindorm-io/common-types";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  AuthenticationConfirmationToken,
  AuthenticationConfirmationTokenOptions,
} from "../../entity";

export const createTestAuthenticationConfirmationToken = (
  options: Partial<AuthenticationConfirmationTokenOptions> = {},
): AuthenticationConfirmationToken => {
  const { id, signature } = createOpaqueToken();

  return new AuthenticationConfirmationToken({
    id,
    clientId: randomUUID(),
    confirmedIdentifiers: ["test@lindorm.io", "0701234567"],
    country: "se",
    expires: new Date("2022-01-01T08:01:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 1,
    maximumLevelOfAssurance: 1,
    metadata: {},
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    nonce: randomString(16),
    remember: true,
    sessionId: randomUUID(),
    signature,
    singleSignOn: true,

    ...options,
  });
};
