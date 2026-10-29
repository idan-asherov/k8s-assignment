# מפעל עוגיות המזל – חלק ב'

אפליקציה קטנה שמחלקת עוגיות מזל, ובכל עוגייה רואים איזה Pod אפה אותה. היא מראה איך Kubernetes מחלק עומס, מחזיר Pods שנפלו ומעדכן גרסה בלי להפיל את האתר.

עבדתי על k3s בשרת Ubuntu ולא על minikube. בגלל זה האימג'ים נבנים עם Docker ומיובאים ל-k3s, ובכל ה-YAML יש `imagePullPolicy: Never`.

## מבנה

```
api/        שרת Node.js + Express (GET /api/fortune), Dockerfile
frontend/   index.html + nginx.conf + Dockerfile
k8s/        api-deployment, api-service, web-deployment, web-service
screenshots/
```

הזרימה: דפדפן ← NodePort (30090) ← nginx (frontend) ← ClusterIP `fortune-api:3000` ← 3 Pods של ה-API.

## הרצה מאפס

```bash
# 1. בניית האימג'ים וייבוא ל-k3s
cd api
docker build -t fortune-api:v1 .
docker save fortune-api:v1 | sudo k3s ctr images import -
cd ../frontend
docker build -t fortune-web:v1 .
docker save fortune-web:v1 | sudo k3s ctr images import -
cd ..

# 2. פריסה
kubectl apply -f k8s/api-deployment.yaml -f k8s/api-service.yaml
kubectl apply -f k8s/web-deployment.yaml -f k8s/web-service.yaml

# 3. בדיקה
kubectl get pods
curl -s localhost:30090/api/fortune
# בדפדפן: http://<כתובת-השרת>:30090
```

## מה נבדק בכל שלב

**שלב 1 – ה-API.** בניתי אימג' `fortune-api:v1`, הרצתי אותו עם `docker run`, וקיבלתי JSON עם `fortune`, `pod` ו-`version`.

**שלב 2 – פריסה.** Deployment של 3 רפליקות ו-Service מסוג ClusterIP על פורט 3000. מתוך Pod זמני שלחתי 8 בקשות ל-`http://fortune-api:3000/api/fortune` וקיבלתי תשובות משלושה Pods שונים, כלומר ה-Service מחלק בין הרפליקות.

**שלב 3 – Frontend.** דף HTML עם כפתור "פתחו עוגייה", מוגש מ-nginx, וה-nginx מעביר את `/api/` ל-`fortune-api:3000`. Deployment של 2 רפליקות ו-NodePort על 30090. בדפדפן לחצתי כמה פעמים וראיתי תשובות משלושה Pods שונים.

**למה הדפדפן לא פונה ישר ל-`fortune-api`?** `fortune-api` הוא ClusterIP, כתובת פנימית שקיימת רק בתוך הקלאסטר, והדפדפן במחשב שלי לא רואה אותה. ה-nginx רץ בתוך הקלאסטר ולכן הוא כן רואה אותה, והוא חשוף החוצה דרך NodePort. הדפדפן מדבר רק עם nginx, ו-nginx מעביר את הבקשות פנימה.

## ניסויים

### שלב 4 – כאוס במאפייה

הרצתי לולאה שפונה לאתר כל חצי שנייה ומדפיסה איזה Pod ענה (או FAIL), ובמקביל `kubectl get pods -w`.

- **מחיקת Pod אחד של ה-API:** האתר לא נפל. בלולאה לא הופיע FAIL, ושני ה-Pods האחרים המשיכו לענות. Pod חדש עלה תוך כ-4 שניות עד `1/1 Running`. ה-Pod שנמחק לא קיבל יותר בקשות, כי ה-`readinessProbe` וה-Service מוציאים אותו מהרשימה.
- **הגדלה ל-6 רפליקות:** שיניתי את `replicas` ל-6 בקובץ ועשיתי `apply`. אחרי 40 בקשות ראיתי 6 שמות Pod שונים. ה-Service מוסיף אוטומטית את ה-Pods החדשים לרשימת ה-endpoints, ולא נגעתי באף דבר אחר.
- **הקטנה ל-1:** נשאר Pod אחד וכל 20 הבקשות חזרו ממנו. אין יותר חלוקת עומס, והמונה של ה-Pod הזה עולה ברצף. אם הוא ייפול האתר יהיה למטה עד שיעלה Pod חדש, כמה שניות. הרגשתי שזה הרבה פחות יציב.
- **הערה:** אחרי המחיקה וההקטנה ה-Pods הישנים הסתיימו עם סטטוס `Error`. שרת Node לא טיפל בכיבוי, ולכן Kubernetes סגר אותו בכוח אחרי תקופת חסד. בגרסה v2 הוספתי טיפול ב-SIGTERM.

### שלב 5 – עוגיות v2

- **תערובת v1 ו-v2 בזמן ה-rollout:** שיניתי ב-YAML את האימג' ל-`fortune-api:v2` ואת `APP_VERSION` ל-`v2` (בגרסה הזאת כל עוגייה מתחילה ב-`[v2]`), עשיתי `apply`, ובמקביל הרצתי לולאה שפונה לאתר כל 0.3 שניות. במשך כמה שניות ראיתי תערובת: v1, v2, v1, v2 ברצף, כי בזמן ה-rollout גם Pods ישנים וגם חדשים מקבלים בקשות. אחר כך נשארו רק v2. זה עבד בלי בקשות שנכשלו, בזכות `maxUnavailable: 0` ו-`readinessProbe`.
- **`kubectl rollout undo`:** החזרתי ל-v1 עם `kubectl rollout undo deployment/fortune-api`. בדפדפן העוגיות חזרו להיות בלי `[v2]` והשורה הקטנה הראתה `version: v1`. ב-`rollout history` יש רוויזיות 2 ו-3: ה-`undo` מספר מחדש את הגרסה שחוזרים אליה, ולכן 1 נעלמה. אחרי ה-`undo` תיקנתי גם את הקובץ ל-v1 כדי שיתאים לקלאסטר.

## בונוסים

- **מונה בדף:** כל Pod סופר כמה עוגיות הוא אפה (השדה `baked`), והוא מופיע בדף.
- **`readinessProbe`:** על `/healthz`. Pod חדש נכנס ל-Service רק אחרי שענה ל-probe, ולכן בזמן מחיקה או rollout אין בקשות שנפלות על Pod שעוד לא מוכן.
- **requests ו-limits:** מוגדרים לכל הקונטיינרים.
