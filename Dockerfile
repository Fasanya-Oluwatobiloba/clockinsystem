# 1. Use Node 18
FROM node:18

# 2. Set the timezone to Nigeria
ENV TZ=Africa/Lagos

# 3. Create app directory
WORKDIR /usr/src/app

# 4. Copy package files
COPY package*.json ./

# 5. Install dependencies + FULL ICU for locales like en-NG
RUN npm install
RUN npm install full-icu

# 6. Copy code
COPY . .

# 7. Expose your port
EXPOSE 3001

# 8. Start with the ICU data flag so en-NG works correctly
CMD [ "node", "--icu-data-dir=node_modules/full-icu", "index.js" ]
