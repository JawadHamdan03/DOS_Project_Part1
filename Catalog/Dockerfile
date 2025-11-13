FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p db
EXPOSE 4001
CMD ["node", "server.js"]