import fs from "fs-extra";
import inquirer from "inquirer";
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
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Enter package name",
    },
  ]);

  const srcDir = path.join(__dirname, "..", ".init", "package");
  const destDir = path.join(__dirname, "..", "packages", answers.name);
  const placeholder = new RegExp("{{NAME}}", "g");

  await copyFiles(srcDir, destDir);
  await replaceInFiles(destDir, placeholder, answers.name);

  console.log(`Package ${answers.name} initialised in /packages/${answers.name}`);
};

main()
  .catch(console.error)
  .finally(() => process.exit(0));
