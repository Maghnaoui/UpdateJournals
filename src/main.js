import fetch from "node-fetch";
import * as cheerio from "cheerio";
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

// دالة لجلب بيانات الجرائد من صفحة معينة باستخدام Cheerio مع هيدرات إضافية
async function fetchJournalsForYear(year) {
    const url = getJournalPageUrl(year);
    console.log(`جلب الصفحة من: ${url}`);
    
    // إضافة هيدرات لمحاكاة متصفح حقيقي
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
    });
    
    const html = await response.text();
    console.log("تم جلب HTML. الطول:", html.length);
    console.log("HTML snippet:", html.slice(0, 500));
    
    // تحقق إذا كان HTML يحتوي على "MaxWin"
    const containsMaxWin = html.includes("MaxWin");
    console.log("HTML يحتوي على 'MaxWin'؟", containsMaxWin);
    
    const $ = cheerio.load(html);
    const journals = [];

    // استخدام filter لالتقاط كل الروابط التي تحتوي على "MaxWin"
    const links = $("a").filter((i, el) => {
        const href = $(el).attr("href");
        return href && href.includes("MaxWin");
    });
    console.log("عدد الروابط التي تحتوي على 'MaxWin':", links.length);

    links.each((i, elem) => {
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
    console.log(`عدد الجرائد المستخرجة للسنة ${year}: ${journals.length}`);
    return journals;
}

// الوظيفة الأساسية (Handler) التي تُستدعى من Appwrite
export default async (req, res) => {
    try {
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
        console.log(`أحدث رقم جريدة محفوظ: ${lastStoredIssue}`);

        // ترشيح الجرائد الجديدة فقط (حيث يكون رقم العدد أكبر من آخر رقم محفوظ)
        const newJournals = journals.filter(journal => parseInt(journal.number, 10) > lastStoredIssue);
        console.log(`عدد الجرائد الجديدة: ${newJournals.length}`);

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

        if (res && typeof res.json === "function") {
            return res.json({
                message: "تم تحديث بيانات الجرائد بنجاح",
                newCount: newJournals.length,
                data: newJournals
            });
        } else {
            return { 
                message: "تم تحديث بيانات الجرائد بنجاح", 
                newCount: newJournals.length, 
                data: newJournals 
            };
        }
    } catch (error) {
        console.error("حدث خطأ في الوظيفة:", error);
        if (res && typeof res.status === "function") {
            return res.status(500).json({ error: error.message });
        } else {
            return { error: error.message };
        }
    }
};
