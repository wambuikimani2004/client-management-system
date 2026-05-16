FROM node:18-alpine
WORKDIR /usr/src/app

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "server.js"]
