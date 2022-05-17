import { IdentityPermission, Scope, SubjectHint } from "../common";
import { TokenType } from "../enum";
import { getClients } from "./util/get-clients";
import { getTokenIssuer } from "./util/get-token-issuer";
import { logger } from "./util/logger";
import { randomUUID } from "crypto";

(async (): Promise<void> => {
  try {
    const clients = await getClients();
    const jwt = await getTokenIssuer();

    const { token } = jwt.sign({
      audiences: clients.map((item) => item.id),
      authContextClass: ["loa_4"],
      authMethodsReference: ["generate_admin_token"],
      expiry: "15 minutes",
      levelOfAssurance: 4,
      permissions: Object.values(IdentityPermission),
      scopes: Object.values(Scope),
      sessionId: randomUUID(),
      subject: randomUUID(),
      subjectHint: SubjectHint.IDENTITY,
      type: TokenType.ACCESS,
    });

    logger.info("Generated token", { token });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
