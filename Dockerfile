# Use the official Playwright image — comes with Chromium + all system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Install root deps (concurrently, etc.)
COPY package*.json ./
RUN npm install

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm install

# Install client deps and build the React app
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy all source files
COPY . .

# Build the React frontend into client/dist
RUN cd client && npm run build

# Tell the server it's production mode
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
