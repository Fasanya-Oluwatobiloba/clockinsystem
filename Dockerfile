# 1. Use a standard Node 18 image
FROM node:18

# 2. Set the working directory
WORKDIR /app

# 3. Copy only package files first to speed up builds
COPY package*.json ./

# 4. Install dependencies (including full-icu for your en-NG dates)
RUN npm install
RUN npm install full-icu

# 5. Copy the rest of your code (including index.js)
COPY . .

# 6. Use the port Back4app expects (usually 8080 or what you set in dashboard)
ENV PORT=3001
EXPOSE 3001

# 7. Start the server with ICU data for Nigerian date support
CMD ["node", "--icu-data-dir=node_modules/full-icu", "index.js"]