# 1. Use the official Node.js image
FROM node:18

# 2. Create and set the app directory
WORKDIR /usr/src/app

# 3. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your app code
COPY . .

# 5. Expose the port (Back4app uses 8080 by default, or your process.env.PORT)
EXPOSE 3001

# 6. Start the server
CMD [ "node", "index.js" ]
