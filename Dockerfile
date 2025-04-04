# ÇÓÊÎÏÇã ÕæÑÉ Node.js ÇáãÈäíÉ Úáì Alpine Linux
FROM node:20-alpine

# ÊËÈíÊ Chromium æÇáÇÚÊãÇÏíÇÊ ÇááÇÒãÉ áÊÔÛíá Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    font-noto-emoji

# ÊÚííä ãÊÛíÑÇÊ ÇáÈíÆÉ áÊÍÏíÏ ãßÇä Chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV CHROME_BIN="/usr/bin/chromium-browser"

# ÊÚííä ãÌáÏ ÇáÚãá ÏÇÎá ÇáÍÇæíÉ
WORKDIR /app

# äÓÎ ãáİÇÊ package.json æ package-lock.json ÃæáÇğ áÊËÈíÊ ÇáÇÚÊãÇÏíÇÊ
COPY package.json package-lock.json ./
RUN npm install

# äÓÎ ÈÇŞí ãáİÇÊ ÇáãÔÑæÚ
COPY . .

# ÇáÃãÑ ÇáÇİÊÑÇÖí áÊÔÛíá ÇáæÙíİÉ
CMD ["node", "src/main.js"]
