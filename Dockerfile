# استخدام صورة Node.js المبنية على Alpine Linux
FROM node:20.19.0-alpine

# تثبيت Chromium والاعتماديات اللازمة لتشغيل Puppeteer
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

# تعيين متغيرات البيئة لتحديد مكان Chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV CHROME_BIN="/usr/bin/chromium-browser"

# تعيين مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات package.json و package-lock.json أولاً لتثبيت الاعتماديات
COPY package.json package-lock.json ./
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# الأمر الافتراضي لتشغيل الوظيفة
CMD ["node", "src/main.mjs"]
