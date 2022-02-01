# Create base image only when needed
FROM node:16-alpine AS base_image

RUN apk --no-cache -U upgrade
RUN apk add --no-cache libc6-compat
### RUN yarn set version berry


# Install builder dependencies only when needed
FROM base_image AS builder_dependencies
WORKDIR /app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install --frozen-lockfile


# Install runner dependencies only when needed
FROM base_image AS dependencies
WORKDIR /app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install --production --frozen-lockfile


# Rebuild source only when needed
FROM base_image AS builder
WORKDIR /app

COPY generated generated
COPY src src
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY --from=builder_dependencies /app/node_modules node_modules

RUN yarn build


# Create docker image
FROM base_image AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

COPY config config
COPY package.json package.json
COPY --from=dependencies /app/node_modules node_modules
COPY --from=builder /app/dist dist

EXPOSE 3000

CMD ["yarn", "start"]
