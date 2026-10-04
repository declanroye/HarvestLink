FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV HOST=0.0.0.0 PORT=4173
USER node
EXPOSE 4173
CMD ["node","server.mjs"]
