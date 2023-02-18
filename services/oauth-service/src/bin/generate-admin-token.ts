import { LindormScopes, LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { getClients } from "./util/get-clients";
import { getJwt } from "./util/get-jwt";
import { logger } from "./util/logger";
import { randomUUID } from "crypto";

const main = async (): Promise<void> => {
  const [id] = process.argv.slice(2);

  const clients = await getClients();
  const jwt = await getJwt();

  const { token } = jwt.sign({
    audiences: clients.map((item) => item.id),
    authContextClass: ["loa_4"],
    authMethodsReference: ["generate_admin_token"],
    expiry: "15 minutes",
    levelOfAssurance: 4,
    scopes: Object.values(LindormScopes),
    session: randomUUID(),
    subject: id || randomUUID(),
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.ACCESS,
  });

  logger.info("Generated token", { token });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
