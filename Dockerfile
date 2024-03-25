# Build stage
FROM node:18-alpine

# Label
LABEL author="@ItzNotABug"

# Set working directory
WORKDIR /usr/src/app

# Copy the rest of your application code
COPY . .

# Install PM2 globally
RUN npm install pm2 -g

# Install dependencies
RUN npm ci --omit-dev

# Expose port
EXPOSE 2369

# Start your app
CMD ["pm2-runtime", "start", "app.js", "--name", "ghosler-app"]