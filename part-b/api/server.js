const express = require("express");
const os = require("os");

const app = express();
const PORT = 3000;
const VERSION = process.env.APP_VERSION || "unknown";
const POD = os.hostname();

const fortunes = [
  "היום תמצא באג שחיפשת שבוע. הוא היה בשורה הראשונה.",
  "מי שמריץ kubectl delete בלי לבדוק, ילמד לבדוק.",
  "הקפה הבא שלך יהיה מצוין, וגם ה-rollout.",
  "Pod אחד נפל, אבל שלושה אחרים כבר אפו במקומו.",
  "הצלחה היא Deployment שעבר בלי שאף אחד שם לב.",
  "יום טוב להתחיל פרויקט חדש, או לפחות להפסיק לדחות את הישן.",
  "הסבלנות היא ה-readinessProbe של החיים.",
  "מישהו קרוב אליך חושב עליך. כנראה בגלל ה-merge request.",
  "החלטה קטנה היום תחסוך לך שלוש שעות מחר.",
  "הדבר הטוב ביותר שתעשה היום הוא לשמור קובץ לפני שמריצים.",
  "אל תפחד ממצב ErrImagePull, גם הוא עובר.",
  "בקרוב תקבל חדשות טובות, כנראה מהנתב."
];

let baked = 0; // כמה עוגיות ה-Pod הזה אפה (בונוס)

app.get("/api/fortune", (req, res) => {
  baked += 1;
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  res.json({ fortune: "[v2] " + fortune, pod: POD, version: VERSION, baked });
});

// נקודה פשוטה ל-readinessProbe (בונוס)
app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`fortune-api ${VERSION} listening on ${PORT} (pod ${POD})`);
});

// כיבוי נקי: ללא זה Node (תהליך 1) מתעלם מ-SIGTERM וה-Pod נהרג אחרי 30 שניות
process.on("SIGTERM", () => process.exit(0));
