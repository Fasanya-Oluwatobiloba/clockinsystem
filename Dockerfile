# Use a lightweight Node image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the index.js and other files
COPY . .

# Set Port
ENV PORT=3001
EXPOSE 3001

# Standard start command
CMD ["node", "index.js"]
