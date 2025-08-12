import { execSync } from "child_process";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// --- الخطوة 1: تهيئة Firebase Admin SDK ---
// لا تضع بيانات الاعتماد هنا مباشرة! سنستخدم Github Secrets.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// --- دوال مساعدة ---

function getJournalPageUrl(year) {
  return `https://www.joradp.dz/JRN/ZA${year}.htm`;
}

async function fetchRenderedHTML(url) {
  console.log(`جلب الصفحة من: ${url}`);
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 60000,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();
  await browser.close();
  return html;
}

function getMonthNumber(arabicMonth) {
  const mapping = {
    "جـانفي": "01", "جانفي": "01", "يناير": "01",
    "فبراير": "02",
    "مارس": "03",
    "أبريل": "04",
    "مايو": "05",
    "يونيو": "06",
    "يوليو": "07",
    "غشت": "08", "أغسطس": "08",
    "سبتمبر": "09",
    "أكتوبر": "10",
    "نوفمبر": "11",
    "ديسمبر": "12"
  };
  return mapping[arabicMonth.trim()] || "00";
}

// --- دالة استخلاص البيانات الجديدة (بناءً على منطق Python) ---
async function fetchJournalsForYear(year) {
  const url = getJournalPageUrl(year);
  const html = await fetchRenderedHTML(url);
  const $ = cheerio.load(html);
  const journals = [];

  // البحث عن كل جداول الشهور في الصفحة
  const monthTables = $('body > div > table:nth-child(3) > tbody > tr > td > table');

  monthTables.each((i, table) => {
    const monthHeader = $(table).find('th').first();
    if (!monthHeader) return;

    const monthText = monthHeader.text().trim();
    const cleanedMonth = monthText.replace(/[0-9()/-]/g, '').trim();
    const monthNumber = getMonthNumber(cleanedMonth);

    if (monthNumber === "00") return;

    console.log(`\nشهر جديد: ${cleanedMonth} -> ${monthNumber}`);

    let dayCounter = 0;
    $(table).find('tr').slice(1).find('td').each((j, cell) => {
      const cellText = $(cell).text().trim();
      const link = $(cell).find('a[href*="MaxWin"]');

      if (cellText && /^\d+$/.test(cellText)) {
        dayCounter = parseInt(cellText, 10);
      }
      
      if (link.length > 0) {
        // إذا لم يكن هناك نص يوم في الخلية، نستخدم العداد الحالي
        if (!cellText || !/^\d+$/.test(cellText)) {
           dayCounter++;
        }

        const jsCall = link.attr("href");
        const match = jsCall?.match(/MaxWin\('([^']+)'\)/);
        if (match) {
          const issue = match[1];
          const dateStr = `${year}-${monthNumber}-${dayCounter.toString().padStart(2, '0')}`;
          const pdfUrl = `https://www.joradp.dz/FTP/jo-arabe/${year}/A${year}${issue}.pdf`;
          
          console.log(`وجدت جريدة: رقم ${issue} بتاريخ ${dateStr}`);
          
          journals.push({
            number: issue,
            date: dateStr,
            pdfUrl: pdfUrl,
            year: parseInt(year, 10),
            sortableNumber: parseInt(issue.replace(/\D/g, ''), 10) || 0,
          });
        }
      }
    });
  });

  console.log(`\nإجمالي الجرائد المستخرجة للسنة ${year}: ${journals.length}`);
  return journals;
}

// --- دالة إرسال الإشعار (تبقى كما هي) ---
function sendNotification(journal) {
  console.log(`إرسال إشعار للجريدة رقم ${journal.number}...`);
  const serverKey = process.env.FCM_SERVER_KEY;
  const command = `
    curl -X POST -H "Authorization: key=${serverKey}" \
    -H "Content-Type: application/json" \
    -d '{
          "to": "/topics/new_journal",
          "notification": {
            "title": "عدد جديد من الجريدة الرسمية!",
            "body": "صدر العدد رقم ${journal.number} لسنة ${journal.year}.",
            "sound": "default"
          }
        }' \
    https://fcm.googleapis.com/fcm/send
  `;
  try {
    execSync(command, { stdio: 'inherit' });
    console.log("تم إرسال الإشعار بنجاح.");
  } catch (error) {
    console.error("خطأ في إرسال الإشعار:", error);
  }
}


// --- الدالة الرئيسية (تبقى كما هي) ---
const run = async () => {
  try {
    const currentYear = new Date().getFullYear().toString();
    const journals = await fetchJournalsForYear(currentYear);

    const journalsRef = db.collection("journals");
    const snapshot = await journalsRef
      .where("year", "==", parseInt(currentYear, 10))
      .orderBy("sortableNumber", "desc")
      .limit(1)
      .get();

    let lastStoredIssue = 0;
    if (!snapshot.empty) {
      lastStoredIssue = snapshot.docs[0].data().sortableNumber;
    }
    console.log(`أحدث رقم جريدة محفوظ: ${lastStoredIssue}`);

    const newJournals = journals.filter(
      (journal) => journal.sortableNumber > lastStoredIssue
    );
    console.log(`عدد الجرائد الجديدة: ${newJournals.length}`);

    if (newJournals.length > 0) {
      const batch = db.batch();
      for (const journal of newJournals) {
        const docRef = journalsRef.doc(`${journal.year}_${journal.number}`);
        batch.set(docRef, journal);
        console.log(`تمت إضافة الجريدة: ${journal.year}_${journal.number}`);
        
        sendNotification(journal);
      }
      await batch.commit();
      console.log("تم حفظ كل الجرائد الجديدة بنجاح.");

      const metadataRef = db.collection("metadata").doc("years");
      const metadataDoc = await metadataRef.get();
      if (metadataDoc.exists) {
        const data = metadataDoc.data();
        if (data) {
            const existingYears = data.availableYears || [];
            if (!existingYears.includes(parseInt(currentYear, 10))) {
              console.log(`إضافة السنة الجديدة ${currentYear} إلى metadata...`);
              // إضافة السنة الجديدة في بداية القائمة للحفاظ على الترتيب
              existingYears.unshift(parseInt(currentYear, 10));
              await metadataRef.update({ availableYears: existingYears });
            }
        }
      }
    }

    console.log({
      message: "تم تحديث بيانات الجرائد بنجاح",
      newCount: newJournals.length,
    });
  } catch (error) {
    console.error("حدث خطأ في الوظيفة:", error);
  }
};

run();
