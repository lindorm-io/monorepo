import { input } from "@inquirer/prompts";
import fs from "fs-extra";
import path from "path";

const copyFiles = async (srcDir: string, destDir: string): Promise<void> => {
  try {
    await fs.copy(srcDir, destDir);
  } catch (error) {
    console.error(`Error during copy: ${error}`);
  }
};

const replaceInFiles = async (
  dir: string,
  placeholder: RegExp,
  replacement: string,
): Promise<void> => {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await replaceInFiles(filePath, placeholder, replacement);
    } else if (stat.isFile()) {
      try {
        let content = await fs.readFile(filePath, "utf8");
        content = content.replace(placeholder, replacement);
        await fs.writeFile(filePath, content, "utf8");
      } catch (error) {
        console.error(`Error processing file ${filePath}: ${error}`);
      }
    }
  }
};

const main = async () => {
  const answer = await input({
    message: "Enter package name",
  });
  const name = answer.trim().toLowerCase();

  const srcDir = path.join(__dirname, "..", ".init", "package");
  const destDir = path.join(__dirname, "..", "packages", name);
  const placeholder = new RegExp("{{NAME}}", "g");

  await copyFiles(srcDir, destDir);
  await replaceInFiles(destDir, placeholder, name);

  console.log(`Package ${name} initialised in /packages/${name}`);
};

main()
  .catch(console.error)
  .finally(() => process.exit(0));
