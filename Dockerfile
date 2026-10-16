# Cloud Run image: build the Nuxt app, then run only the server output.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Scripts are skipped here because postinstall (nuxt prepare) needs the source; the build runs it.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 NUXT_STORAGE=firestore
COPY --from=build /app/.output ./.output
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
