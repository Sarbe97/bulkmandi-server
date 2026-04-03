# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory within the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install Chromium and required dependencies for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Tell Puppeteer to skip downloading Chrome and use the system's Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install dependencies
RUN npm install

# Copy the entire application source code to the container
COPY . .

# Create a logs directory
RUN mkdir -p logs

#Env
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Expose the port your application will listen on
EXPOSE 3001

# Specify the command to start your application
CMD ["node", "dist/main"]
