import { Readable } from "stream";

export const getReadStreamContent = (stream: Readable): Promise<string> =>
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
