import { Readable } from "stream";

export const getReadableContent = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    let content = "";
    stream.on("data", (chunk) => {
      content += chunk;
    });
    stream.on("end", () => {
      resolve(content);
    });
    stream.on("error", reject);
  });
