import { SignatureKit } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";

export const signCookie = async (amphora: IAmphora, value: string): Promise<string> => {
  const kryptos = await amphora.find({
    isExternal: false,
    operations: ["sign"],
    $or: [{ purpose: "cookie" }, { purpose: "session" }, { purpose: undefined }],
    use: "sig",
  });

  const kit = new SignatureKit({ kryptos });

  return kit.format(kit.sign(value));
};
