# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory within the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire application source code to the container
COPY . .

# Create a logs directory
RUN mkdir -p logs

#Env
ENV NODE_ENV=production

# Build the Nuxt.js application (replace "build" with the appropriate Nuxt.js command)
RUN npm run build

# Expose the port your application will listen on (typically 3000 for Nuxt.js)
EXPOSE 3002

# Specify the command to start your Nuxt.js application
CMD ["node", "dist/main"]
