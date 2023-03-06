import { ServerSocket } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { ChallengeConfirmationTokenClaims } from "../../common";
import { configuration } from "../../server/configuration";

export const joinDeviceChannel = (socket: ServerSocket): ServerSocket =>
  socket.on("join_device_channel", (token: string) => {
    const { jwt } = socket.ctx;

    if (!token) {
      throw new ClientError("Invalid token", {
        description: "Token could not be found",
      });
    }

    const verified = jwt.verify<ChallengeConfirmationTokenClaims>(token, {
      issuer: configuration.services.device_service.issuer,
    });

    socket.join(verified.claims.deviceLinkId);
  });
