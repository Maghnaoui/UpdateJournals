//import { Client, Users } from 'node-appwrite';

// استيراد المكتبات
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { Client, Databases } from "node-appwrite";

// تهيئة عميل Appwrite
const client = new Client();

client
    .setEndpoint("https://cloud.appwrite.io/v1") // عنوان خادم Appwrite
    .setProject("67e18ee000318f712934")                    // معرف المشروع
    .setKey("standard_238f302a4f67efe218c9152db533f95e4e817201a5dcd360dd8da3515db71e158a05d3dc3f0ca1aa92d9ffa7418871ef71dee5c340aada50830ff898d345abe07bfb0e5a55afe275a72e451d0a24f95c04e5959c87c8a5a1f19438e4ecfd5253e5cd0853879e1caa23e56b2a7269c9c751e0da43b65d33d99bb8610afe81f0ac");                          // مفتاح API (إن احتجت)

const databases = new Databases(client, "67e208370009f4c926ed");

// دالة لتوليد رابط صفحة الجرائد لسنة معينة
function getJournalPageUrl(year) {
    return `https://www.joradp.dz/JRN/ZA${year}.htm`;
}

// دالة لجلب بيانات الجرائد من صفحة معينة
async function fetchJournalsForYear(year) {
    const url = getJournalPageUrl(year);
    // جلب المحتوى
    const response = await fetch(url);
    const html = await response.text();

    // تحليل HTML باستخدام Cheerio
    const $ = cheerio.load(html);
    const journals = [];

    // البحث عن الروابط التي تحتوي على javascript:MaxWin('XXX')
    $("a[href^='javascript:MaxWin']").each((i, elem) => {
        const jsCall = $(elem).attr("href"); // مثل: javascript:MaxWin('001')
        const match = jsCall.match(/MaxWin\('(\d+)'\)/);
        if (match) {
            const issue = match[1]; // رقم الجريدة (مثل "001")
            // توليد رابط PDF بناءً على السنة والرقم
            const pdfUrl = `https://www.joradp.dz/FTP/jo-arabe/${year}/A${year}${issue}.pdf`;
            // استخدم تاريخ اليوم كتاريخ اكتشاف
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
}

// الوظيفة الأساسية (Handler) التي تستدعيها Appwrite
export default async (req, res) => {
    try {
        // يمكنك اختيار السنة الحالية أو أي سنة أخرى
        //const currentYear = new Date().getFullYear().toString();
        // إذا أردت المرور على عدة سنوات (مثلاً من 1964 إلى السنة الحالية)، يمكنك كتابة حلقة

        //const journals = await fetchJournalsForYear(currentYear);

        let journals = [];
        for (let y = 1964; y <= new Date().getFullYear(); y++) {
        const yearJournals = await fetchJournalsForYear(y.toString());
        journals = journals.concat(yearJournals);
        }

      
        // إنشاء أو تحديث المستندات في Appwrite Database
        for (const journal of journals) {
            // تحديد معرّف المستند (Document ID)
            // يمكنك استخدام "unique()" لإنشاء معرف تلقائي
            // أو use year+number كـ docId
            const docId = `${journal.year}_${journal.number}`;

            try {
                await databases.createDocument(
                    "67e208370009f4c926ed",  // معرف قاعدة البيانات
                    "67e2085c001f7c56c20e",// معرف المجموعة "journals"
                    docId,
                    journal
                );
                console.log(`تم إضافة الجريدة: ${docId}`);
            } catch (error) {
                // إذا كان المستند موجودًا بالفعل أو حدث خطأ آخر
                console.error(`خطأ في إضافة الجريدة ${docId}:`, error);
            }
        }

        // إرجاع استجابة نجاح
        res.json({
            message: "تم تحديث بيانات الجرائد بنجاح",
            count: journals.length,
            data: journals
        });
    } catch (error) {
        console.error("حدث خطأ في الوظيفة:", error);
        res.status(500).json({ error: error.message });
    }
};
