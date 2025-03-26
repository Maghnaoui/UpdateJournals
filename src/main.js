import fetch from "node-fetch";
import cheerio from "cheerio";
import { Client, Databases, Query } from "node-appwrite";

// تهيئة عميل Appwrite
const client = new Client();

client
    .setEndpoint("https://cloud.appwrite.io/v1") // استبدل بعنوان خادم Appwrite الخاص بك
    .setProject("67e18ee000318f712934")               // استبدل بمعرف مشروعك
    .setKey("standard_238f302a4f67efe218c9152db533f95e4e817201a5dcd360dd8da3515db71e158a05d3dc3f0ca1aa92d9ffa7418871ef71dee5c340aada50830ff898d345abe07bfb0e5a55afe275a72e451d0a24f95c04e5959c87c8a5a1f19438e4ecfd5253e5cd0853879e1caa23e56b2a7269c9c751e0da43b65d33d99bb8610afe81f0ac");                     // مفتاح API إن كنت تحتاجه

const databases = new Databases(client, "67e208370009f4c926ed");    // معرف قاعدة البيانات

// دالة لتوليد رابط صفحة الجرائد لسنة معينة
function getJournalPageUrl(year) {
    return `https://www.joradp.dz/JRN/ZA${year}.htm`;
}

// دالة لجلب بيانات الجرائد من صفحة معينة باستخدام Cheerio مع تحديد مهلة لطلب fetch
async function fetchJournalsForYear(year) {
    const url = getJournalPageUrl(year);
    
    // تحديد مهلة الطلب (مثلاً 10 ثواني)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const html = await response.text();
        const $ = cheerio.load(html);
        const journals = [];

        // البحث عن الروابط التي تحتوي على javascript:MaxWin('XXX')
        $("a[href^='javascript:MaxWin']").each((i, elem) => {
            const jsCall = $(elem).attr("href"); // مثل: javascript:MaxWin('001')
            const match = jsCall.match(/MaxWin\('(\d+)'\)/);
            if (match) {
                const issue = match[1]; // رقم الجريدة مثل "001"
                const pdfUrl = `https://www.joradp.dz/FTP/jo-arabe/${year}/A${year}${issue}.pdf`;
                // استخدام تاريخ اليوم كتاريخ اكتشاف
                const date = new Date().toLocaleDateString("ar-EG", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                });
                journals.push({
                    number: issue,
                    date: date,
                    pdfUrl: pdfUrl,
                    year: year
                });
            }
        });

        return journals;
    } catch (error) {
        throw new Error("Fetch timed out or failed: " + error.message);
    }
}

// الوظيفة الأساسية (Handler) التي تُستدعى من Appwrite
export default async (req, res) => {
    try {
        // استخدام السنة الحالية فقط لجلب الجرائد الجديدة
        const currentYear = new Date().getFullYear().toString();
        const journals = await fetchJournalsForYear(currentYear);

        // استعلام للحصول على أحدث جريدة محفوظة للسنة الحالية
        const latestDoc = await databases.listDocuments(
            "67e208370009f4c926ed",  // معرف قاعدة البيانات
            "67e2085c001f7c56c20e",  // معرف المجموعة "journals"
            [
                Query.equal("year", currentYear),
                Query.orderDesc("number"),
                Query.limit(1)
            ]
        );

        let lastStoredIssue = 0;
        if (latestDoc.documents && latestDoc.documents.length > 0) {
            lastStoredIssue = parseInt(latestDoc.documents[0].number, 10);
        }

        // ترشيح الجرائد الجديدة فقط (حيث يكون رقم العدد أكبر من آخر رقم محفوظ)
        const newJournals = journals.filter(journal => parseInt(journal.number, 10) > lastStoredIssue);

        // إضافة الجرائد الجديدة إلى قاعدة البيانات
        for (const journal of newJournals) {
            const docId = `${journal.year}_${journal.number}`;
            try {
                await databases.createDocument(
                    "67e208370009f4c926ed",  // معرف قاعدة البيانات
                    "67e2085c001f7c56c20e",  // معرف المجموعة "journals"
                    docId,
                    journal
                );
                console.log(`تمت إضافة الجريدة: ${docId}`);
            } catch (error) {
                console.error(`خطأ في إضافة الجريدة ${docId}:`, error);
            }
        }

        res.json({
            message: "تم تحديث بيانات الجرائد بنجاح",
            newCount: newJournals.length,
            data: newJournals
        });
    } catch (error) {
        console.error("حدث خطأ في الوظيفة:", error);
        res.status(500).json({ error: error.message });
    }
};
