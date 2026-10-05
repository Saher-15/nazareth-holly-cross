# בדיקת בוקר — 6 באוקטובר 2026

## 1. האתר החי (כבר באוויר): https://nazarethholycross.com
האתר החדש (Next.js, 14 שפות). נבדקו 31 כתובות בייצור: כולן עובדות, וכתובות ישנות (`/latin`, `/product/…`) מפנות.
דברים כדאי לבדוק בעיניים: `/he`, `/ar`, `/uk`, `/en/shop`, `/en/plan`, `/en/gallery`, `/en/credits`, `/en/candle`.

## 2. הדשבורד של האדמין (מקומי בלבד, לא באוויר)
רץ עכשיו על המחשב:
- דשבורד: **http://localhost:3911/login**
- API מקומי עם נתוני דמה: http://localhost:3912 (קוד ה-API האמיתי, אבל נתונים בזיכרון — אין MongoDB במחשב)

כניסה לבדיקה (משתמשים של דמה שקיימים רק כאן):

| משתמש | סיסמה | תפקיד |
|---|---|---|
| `owner` | `Owner-Mock-Pass-1` | owner (הכול) |
| `editor` | `Editor-Mock-Pass-1` | editor |
| `viewer` | `Viewer-Mock-Pass-1` | viewer (קריאה בלבד) |
| `secure` | `Secure-Mock-Pass-1` | owner + אימות דו-שלבי; סוד: `JBSWY3DPEHPK3PXP` (להוסיף לאפליקציית אימות) |

אם השרתים נכבו, להפעיל מחדש (PowerShell):
```
cd C:\Users\saher\nhc\nhc-platform\server ; $env:HARNESS="1"; node test-harness/serve.mjs
cd C:\Users\saher\nhc\nhc-platform\admin ; $env:ADMIN_API_URL="http://127.0.0.1:3912"; $env:SWC_NATIVE_BINDING_CACHE="C:\Users\saher\nhc\.swc-cache"; npx next start -p 3911
```

מה לנסות: התחברות עם סיסמה שגויה (5 פעמים = נעילה), כניסה עם `secure` (קוד TOTP), הזמנות → סימון "נשלח", מוצרים → הוספה/עריכה, משתמשים (יצירת editor), יומן ביקורת, כניסה כ-`viewer` (אין כפתורי שינוי), עברית/ערבית בתפריט השפה.

## 3. מה נבדק
- דשבורד + API: 736 בדיקות שרת, 88 בדיקות ממשק, 102 בדיקות E2E (גם מול ה-mock וגם מול ה-API האמיתי), 98+33 בדיקות חדירה (probes), נגישות נקייה.
- אבטחה: הטוקן לעולם לא מגיע לדפדפן (קוקי httpOnly + SameSite=Strict), CSRF, CSP קפדני, נעילת חשבון, TOTP מוצפן, ביטול סשנים, יומן ביקורת, תפקידים נאכפים בשרת, הגנה מ-CSV injection. `npm audit`: 0 פגיעויות בייצור.

## 4. מה לא נבדק / פתוח
- **לא נבדק מול MongoDB, Render ו-Netlify אמיתיים.** הדשבורד לא באוויר.
- פתוח: בגלל Render כל הבקשות נראות לשרת מאותה כתובת, אז הגבלות לפי IP משותפות (נעילת חשבון כן מבדילה); מי שמנחש שם משתמש יכול לנעול אותו ל-15 דקות.
- תרגומי עברית/ערבית/יוונית/אוקראינית/רומנית/הולנדית נעשו על ידי AI — צריך מבט של דובר שפה, ובמיוחד הטקסטים המשפטיים (`/privacy`, `/terms`).
- PayPal עדיין ב-**Sandbox**.
- סרט הסיור (811MB) עדיין ב-Firebase; גרסאות קטנות מוכנות ב-`C:\Users\saher\nhc\video-out`.
- תמונות ישנות ב-`public/images` בלי מקור/רישיון מתועד.

## 5. החלטות שלך
1. להעלות את הדשבורד לאוויר? זה דורש: מיזוג הענף `admin/integrated`, הגדרת `ADMIN_ORIGINS` ב-Render, הפניית אתר ה-Netlify `nazaretholycrossadmin` למאגר החדש (תיקיית `admin`), ויצירת המשתמש הראשון **על ידך** בטרמינל (`node server/scripts/create-admin.js`, הסיסמה מוקלדת על ידך). מדריך מלא: `docs/ADMIN-RUNBOOK.md`.
2. פרטי PayPal Live (Client ID ו-Secret) — אתה מזין אותם בעצמך ב-Render וב-Netlify.
3. לאשר/לתקן תרגומים לפני קידום האתר.

## 6. לקחים מהלילה
- ב-PR #11 האתר נפל ל-404 בכל הדפים (Netlify לא הפעיל את ה-runtime של Next; ה-CDN שמר את ה-404). שוחזר תוך כ-50 שניות, ותוקן ב-PR #21 עם `@netlify/plugin-nextjs` במפורש. כלל: "pass" של deploy-preview אומר רק שהבנייה הצליחה — **תמיד לבדוק שה-preview מחזיר 200 לפני מיזוג.**
- GitHub Actions היה בתקלה (ריצות תקועות בתור כ-40 דקות).
