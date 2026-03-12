import { checkbox, input, select } from "@inquirer/prompts";
import fs from "fs-extra";
import path from "path";

type Service = "postgres" | "redis" | "mongo" | "kafka" | "rabbitmq";

const serviceConfigs: Record<Service, string> = {
  postgres: `  postgres:
    image: postgres:17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: example
      POSTGRES_DB: default
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U root"]
      interval: 1s
      timeout: 3s
      retries: 10`,

  redis: `  redis:
    image: redis:8
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 1s
      timeout: 3s
      retries: 10`,

  mongo: `  mongo:
    image: mongo:8
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=example
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.runCommand({ping:1})", "--quiet"]
      interval: 1s
      timeout: 3s
      retries: 10`,

  kafka: `  zookeeper:
    image: confluentinc/cp-zookeeper:7.8.6
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    healthcheck:
      test: ["CMD-SHELL", "echo ruok | nc -w 2 localhost 2181 | grep imok"]
      interval: 1s
      timeout: 3s
      retries: 10

  kafka:
    image: confluentinc/cp-kafka:7.8.6
    ports:
      - "9092:9092"
      - "29092:29092"
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:29092
      KAFKA_BROKER_ID: 1
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT_INTERNAL
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,PLAINTEXT_INTERNAL://0.0.0.0:29092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKAJS_NO_PARTITIONER_WARNING: 1
    depends_on:
      zookeeper:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 1s
      timeout: 3s
      retries: 10`,

  rabbitmq: `  rabbitmq:
    image: rabbitmq:4
    ports:
      - "5672:5672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "check_running"]
      interval: 1s
      timeout: 3s
      retries: 10`,
};

const buildComposeFile = (services: Array<Service>): string => {
  const blocks = services.map((s) => serviceConfigs[s]);
  return `services:\n${blocks.join("\n\n")}\n`;
};

const copyFiles = async (srcDir: string, destDir: string): Promise<void> => {
  try {
    await fs.copy(srcDir, destDir);
  } catch (error) {
    console.error(`Error during copy: ${error}`);
  }
};

const cleanup = async (dir: string, withCompose: boolean, services: Array<Service>) => {
  try {
    if (withCompose) {
      await fs.unlink(path.join(dir, "package.json"));
      await fs.rename(
        path.join(dir, "package-compose.json"),
        path.join(dir, "package.json"),
      );
      await fs.writeFile(
        path.join(dir, "docker-compose.yml"),
        buildComposeFile(services),
        "utf8",
      );
    }
    if (!withCompose) {
      await fs.unlink(path.join(dir, "docker-compose.yml"));
      await fs.unlink(path.join(dir, "package-compose.json"));
    }
  } catch (error) {
    console.error(`Error during cleanup: ${error}`);
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

  const withCompose = await select({
    message: "Will you be using docker compose?",
    choices: [
      { value: true, name: "Yes" },
      { value: false, name: "No" },
    ],
  });

  let services: Array<Service> = [];

  if (withCompose) {
    services = await checkbox({
      message: "Select services",
      choices: [
        { value: "postgres" as Service, name: "PostgreSQL" },
        { value: "redis" as Service, name: "Redis" },
        { value: "mongo" as Service, name: "MongoDB" },
        { value: "kafka" as Service, name: "Kafka" },
        { value: "rabbitmq" as Service, name: "RabbitMQ" },
      ],
    });
  }

  const srcDir = path.join(__dirname, "..", ".init", "package");
  const destDir = path.join(__dirname, "..", "packages", name);
  const placeholder = new RegExp("{{NAME}}", "g");

  await copyFiles(srcDir, destDir);
  await cleanup(destDir, withCompose, services);
  await replaceInFiles(destDir, placeholder, name);

  console.log(`Package ${name} initialised in /packages/${name}`);
};

main()
  .catch(console.error)
  .finally(() => process.exit(0));
