FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 복사 (레이어 캐시 최적화)
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# 소스 복사 (.dockerignore로 불필요 파일 제외)
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
