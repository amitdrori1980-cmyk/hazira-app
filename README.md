# 🎭 הזירה — מערכת ניהול הפקה

## התקנה מהירה (צעד אחר צעד)

---

### צעד 1 — התקן Node.js

1. לך ל-[nodejs.org](https://nodejs.org)
2. הורד את הגרסה **LTS** (הירוקה)
3. התקן — לחץ Next בכל המסכים
4. פתח **Terminal** (מק: Cmd+Space → "Terminal" | חלונות: חפש "Command Prompt")
5. בדוק שעובד: `node --version` — אמור להדפיס מספר כמו `v20.x.x`

---

### צעד 2 — הורד את הפרויקט

1. שמור את תיקיית `hazira-app` על המחשב (לדוגמה ב-Desktop)
2. ב-Terminal נווט לתיקייה:
```bash
cd Desktop/hazira-app
```

---

### צעד 3 — הגדר Supabase

1. לך ל-[supabase.com](https://supabase.com) → הפרויקט שלך
2. לחץ **SQL Editor** → **New query**
3. פתח את הקובץ `supabase_setup.sql` מהתיקייה
4. העתק את כל התוכן והדבק ב-SQL Editor
5. לחץ **Run** — תראה הודעת הצלחה

---

### צעד 4 — הוסף משתמש ראשון (מנהל)

1. ב-Supabase לך ל-**Authentication → Users → Add user**
2. מלא:
   - Email: `manager@hazira.co.il`
   - Password: `Hazira2026!`
3. העתק את ה-**User ID** שנוצר (UUID)
4. חזור ל-SQL Editor והרץ (תחליף את ה-ID):
```sql
insert into profiles (id, full_name, role, dept, is_manager)
values ('ה-USER-ID-שהעתקת', 'מנהל הפקה', 'מנהל הפקה', 'הנהלה', true);
```

---

### צעד 5 — הרץ את האפליקציה

```bash
npm install
npm run dev
```

פתח דפדפן וכנס ל: **http://localhost:3000**

התחבר עם:
- **אימייל:** `manager@hazira.co.il`
- **סיסמה:** `Hazira2026!`

---

### צעד 6 — פרסם באינטרנט (Vercel)

1. צור חשבון ב-[vercel.com](https://vercel.com) עם GitHub
2. לחץ **"Add New Project"**
3. גרור את תיקיית `hazira-app` לחלון
4. תחת **Environment Variables** הוסף:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://spxrvldawsqwotmzmlsn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_1T-bPwb5k04eKUuIc7M3qQ_LAisnNep`
5. לחץ **Deploy** — תוך 2 דקות תקבל כתובת URL!

---

## הוספת עובדים נוספים

לכל עובד חדש:
1. Supabase → Authentication → Users → Add user (אימייל + סיסמה)
2. SQL Editor:
```sql
insert into profiles (id, full_name, role, dept, is_manager)
select id, 'שם העובד', 'תפקיד', 'מחלקה', false
from auth.users where email = 'email@hazira.co.il';
```

מחלקות אפשריות: `ניהול` / `תאורה` / `צליל` / `תפאורה` / `תלבושות`
