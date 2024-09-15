# Build stage
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit-dev

# Build stage renamed for clarity, no actual build commands though
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /usr/src/app

# Copy node_modules from 'deps' stage
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the rest of your application code
COPY . .

# Label
LABEL author="@ItzNotABug"

# Install PM2 globally
RUN npm install pm2 -g

# Start your app
CMD ["pm2-runtime", "start", "app.js", "--name", "ghosler-app"]
