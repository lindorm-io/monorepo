import { ConnectSession, ConnectSessionOptions } from "../../entity";
import { CryptoArgon } from "@lindorm-io/crypto";
import { IdentifierType } from "../../common";
import { getRandomString } from "@lindorm-io/core";

const argon = new CryptoArgon();

export const createTestConnectSession = async (
  options: Partial<ConnectSessionOptions> = {},
): Promise<ConnectSession> =>
  new ConnectSession({
    code: await argon.encrypt("secret"),
    identifier: `${getRandomString(16)}@lindorm.io`,
    identityId: "7241cf44-a7ac-4aa0-ba0c-4953f4149971",
    type: IdentifierType.EMAIL,
    ...options,
  });
