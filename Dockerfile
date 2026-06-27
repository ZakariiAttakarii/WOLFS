FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy application files
COPY package.json server.js index.html gameplay.html tutorial.html style.css app.js ./

# Expose default port
EXPOSE 8080

# Start the application
CMD [ "npm", "start" ]
