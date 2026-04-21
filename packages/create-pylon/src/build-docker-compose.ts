import type { Answers, IrisDriver, ProteusDriver } from "./types.js";

type ServiceBlock = { name: string; lines: Array<string> };

const postgresBlock = (): ServiceBlock => ({
  name: "postgres",
  lines: [
    `  postgres:`,
    `    image: postgres:16`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      POSTGRES_DB: app`,
    `      POSTGRES_USER: postgres`,
    `      POSTGRES_PASSWORD: postgres`,
    `    ports:`,
    `      - "5432:5432"`,
  ],
});

const mysqlBlock = (): ServiceBlock => ({
  name: "mysql",
  lines: [
    `  mysql:`,
    `    image: mysql:8`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      MYSQL_DATABASE: app`,
    `      MYSQL_ROOT_PASSWORD: root`,
    `    ports:`,
    `      - "3306:3306"`,
  ],
});

const mongoBlock = (): ServiceBlock => ({
  name: "mongo",
  lines: [
    `  mongo:`,
    `    image: mongo:7`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "27017:27017"`,
  ],
});

const redisBlock = (): ServiceBlock => ({
  name: "redis",
  lines: [
    `  redis:`,
    `    image: redis:7`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "6379:6379"`,
  ],
});

const natsBlock = (): ServiceBlock => ({
  name: "nats",
  lines: [
    `  nats:`,
    `    image: nats:2`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "4222:4222"`,
  ],
});

const rabbitBlock = (): ServiceBlock => ({
  name: "rabbit",
  lines: [
    `  rabbitmq:`,
    `    image: rabbitmq:3-management`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "5672:5672"`,
    `      - "15672:15672"`,
  ],
});

const zookeeperBlock = (): ServiceBlock => ({
  name: "zookeeper",
  lines: [
    `  zookeeper:`,
    `    image: confluentinc/cp-zookeeper:latest`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      ZOOKEEPER_CLIENT_PORT: 2181`,
    `      ZOOKEEPER_TICK_TIME: 2000`,
    `    ports:`,
    `      - "2181:2181"`,
  ],
});

const kafkaBlock = (): ServiceBlock => ({
  name: "kafka",
  lines: [
    `  kafka:`,
    `    image: confluentinc/cp-kafka:latest`,
    `    restart: unless-stopped`,
    `    depends_on:`,
    `      - zookeeper`,
    `    environment:`,
    `      KAFKA_BROKER_ID: 1`,
    `      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181`,
    `      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092`,
    `      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1`,
    `    ports:`,
    `      - "9092:9092"`,
  ],
});

const proteusBlocks = (driver: ProteusDriver): Array<ServiceBlock> => {
  switch (driver) {
    case "postgres":
      return [postgresBlock()];
    case "mysql":
      return [mysqlBlock()];
    case "mongo":
      return [mongoBlock()];
    case "redis":
      return [redisBlock()];
    case "none":
    case "memory":
    case "sqlite":
    default:
      return [];
  }
};

const irisBlocks = (driver: IrisDriver): Array<ServiceBlock> => {
  switch (driver) {
    case "kafka":
      return [zookeeperBlock(), kafkaBlock()];
    case "nats":
      return [natsBlock()];
    case "rabbit":
      return [rabbitBlock()];
    case "redis":
      return [redisBlock()];
    case "none":
    default:
      return [];
  }
};

const dedupeByName = (blocks: Array<ServiceBlock>): Array<ServiceBlock> => {
  const seen = new Set<string>();
  const out: Array<ServiceBlock> = [];
  for (const block of blocks) {
    if (seen.has(block.name)) continue;
    seen.add(block.name);
    out.push(block);
  }
  return out;
};

export const buildDockerCompose = (answers: Answers): string | null => {
  const blocks = dedupeByName([
    ...proteusBlocks(answers.proteusDriver),
    ...irisBlocks(answers.irisDriver),
  ]);

  if (blocks.length === 0) return null;

  const lines: Array<string> = [`services:`];
  for (const block of blocks) {
    lines.push(...block.lines);
  }
  lines.push(``);

  return lines.join("\n");
};
