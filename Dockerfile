FROM node:20

# تحديث apt-get وتثبيت Chromium وبعض المكتبات الضرورية لتشغيل Puppeteer
RUN apt-get update && apt-get install -y \
    chromium-browser \
    fonts-noto \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# تعيين متغيرات البيئة لتحديد مسار Chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium" \
    CHROME_BIN="/usr/bin/chromium"

WORKDIR /app

# نسخ ملفات الحزمة وتثبيت الاعتماديات
COPY package.json package-lock.json ./
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# تشغيل الوظيفة
CMD ["node", "--input-type=module", "src/main.mjs"]
]
