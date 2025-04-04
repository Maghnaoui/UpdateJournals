import { execSync } from "child_process";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Client, Databases, Query } from "node-appwrite";

// تهيئة عميل Appwrite
const client = new Client();
client
    .setEndpoint("https://cloud.appwrite.io/v1") // استبدل بعنوان خادم Appwrite الخاص بك
    .setProject("67e18ee000318f712934") // استبدل بمعرف مشروعك
    .setKey("standard_238f302a4f67efe218c9152db533f95e4e817201a5dcd360dd8da3515db71e158a05d3dc3f0ca1aa92d9ffa7418871ef71dee5c340aada50830ff898d345abe07bfb0e5a55afe275a72e451d0a24f95c04e5959c87c8a5a1f19438e4ecfd5253e5cd0853879e1caa23e56b2a7269c9c751e0da43b65d33d99bb8610afe81f0ac"); // مفتاح API إن كنت تحتاجه

const databases = new Databases(client, "67e208370009f4c926ed"); // معرف قاعدة البيانات

// دالة لتوليد رابط صفحة الجرائد لسنة معينة
function getJournalPageUrl(year) {
  return `https://www.joradp.dz/JRN/ZA${year}.htm`;
}

// دالة تستخدم Puppeteer لجلب HTML بعد تنفيذ JavaScript
async function fetchRenderedHTML(url) {
  console.log(`جلب الصفحة من: ${url}`);
<<<<<<< HEAD
  // إعداد Puppeteer مع بعض الخيارات لتفادي مشاكل sandbox في بيئات السيرفر
  const browser = await puppeteer.launch({
  headless: "new", // استخدام وضع بدون واجهة
  executablePath: "/usr/bin/chromium-browser", // تحديد المسار الصحيح
  args: ["--no-sandbox", "--disable-setuid-sandbox"], // تشغيل بدون صلاحيات root
  timeout: 60000 // مهلة 60 ثانية
});

// دالة لجلب بيانات الجرائد من صفحة معينة باستخدام Cheerio بعد الحصول على HTML النهائي
async function fetchJournalsForYear(year) {
  const url = getJournalPageUrl(year);
  console.log(`جلب الصفحة من: ${url}`);

  const html = await fetchRenderedHTML(url);
  console.log("تم جلب HTML بعد تنفيذ JavaScript. الطول:", html.length);

  const $ = cheerio.load(html);
  const journals = [];

  $("a").each((i, elem) => {
    const jsCall = $(elem).attr("href");
    const match = jsCall?.match(/MaxWin\('(\d+)'\)/);
    if (match) {
      const issue = match[1];
      const pdfUrl = `https://www.joradp.dz/FTP/jo-arabe/${year}/A${year}${issue}.pdf`;
      const date = new Date().toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" });

      journals.push({ number: issue, date: date, pdfUrl: pdfUrl, year: year });
    }
  });

  console.log(`عدد الجرائد المستخرجة للسنة ${year}: ${journals.length}`);
  return journals;
}

// الوظيفة الأساسية (Handler) التي تُستدعى من Appwrite Cloud Function
export default async (req, res) => {
  try {
    const currentYear = new Date().getFullYear().toString();
    const journals = await fetchJournalsForYear(currentYear);

    // استعلام للحصول على أحدث جريدة محفوظة للسنة الحالية من قاعدة البيانات
    const latestDoc = await databases.listDocuments(
      "67e208370009f4c926ed",
      "67e2085c001f7c56c20e",
      [Query.equal("year", currentYear), Query.orderDesc("number"), Query.limit(1)]
    );

    let lastStoredIssue = latestDoc.documents.length > 0 ? parseInt(latestDoc.documents[0].number, 10) : 0;
    console.log(`أحدث رقم جريدة محفوظ: ${lastStoredIssue}`);

    // ترشيح الجرائد الجديدة فقط
    const newJournals = journals.filter(journal => parseInt(journal.number, 10) > lastStoredIssue);
    console.log(`عدد الجرائد الجديدة: ${newJournals.length}`);

    for (const journal of newJournals) {
      try {
        await databases.createDocument("67e208370009f4c926ed", "67e2085c001f7c56c20e", `${journal.year}_${journal.number}`, journal);
        console.log(`تمت إضافة الجريدة: ${journal.year}_${journal.number}`);
      } catch (error) {
        console.error(`خطأ في إضافة الجريدة ${journal.number}:`, error);
      }
    }

    return res?.json
      ? res.json({ message: "تم تحديث بيانات الجرائد بنجاح", newCount: newJournals.length, data: newJournals })
      : { message: "تم تحديث بيانات الجرائد بنجاح", newCount: newJournals.length, data: newJournals };
  } catch (error) {
    console.error("حدث خطأ في الوظيفة:", error);
    return res?.status
      ? res.status(500).json({ error: error.message })
      : { error: error.message };
  }
};
