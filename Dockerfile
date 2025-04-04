# ������� ���� Node.js ������� ��� Alpine Linux
FROM node:20-alpine

# ����� Chromium ������������ ������� ������ Puppeteer
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

# ����� ������� ������ ������ ���� Chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV CHROME_BIN="/usr/bin/chromium-browser"

# ����� ���� ����� ���� �������
WORKDIR /app

# ��� ����� package.json � package-lock.json ����� ������ �����������
COPY package.json package-lock.json ./
RUN npm install

# ��� ���� ����� �������
COPY . .

# ����� ��������� ������ �������
CMD ["node", "src/main.js"]
