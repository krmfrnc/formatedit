FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable || true
RUN npm install
EXPOSE 3000
CMD ["npx", "pnpm", "--filter", "@formatedit/web", "dev"]
