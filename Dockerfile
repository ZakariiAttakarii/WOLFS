FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (leverages Docker cache layer)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application files
COPY server.js index.html gameplay.html tutorial.html result.html style.css app.js ./
COPY art ./art/

# Expose default port
EXPOSE 8080

# Start the application
CMD [ "npm", "start" ]
