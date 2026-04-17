// server/index.js
// ─────────────────────────────────────────────────────────────
//  Lightweight Express server — the ESP32 posts here.
//  This is a THIN PROXY: it validates the API key then
//  writes the clock-in record directly to Firestore.
//
//  Run: node server/index.js
//  Port: 3001 (React dev server runs on 5173)
// ─────────────────────────────────────────────────────────────

import { createRequire } from "module";
const require = createRequire(import.meta.url);

import express from "express";
import cors from "cors";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = express();
app.use(cors());
app.use(express.json());

// ── Firebase Admin init ──────────────────────────────────────
// Uses Application Default Credentials (ADC).
// For local dev, run:  firebase login  then  firebase use clockinsystem-55c67
// For production, set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path.
let db;
try {
  initializeApp();
  db = getFirestore();
  console.log("✅ Firebase Admin connected via ADC");
} catch (e) {
  console.error("❌ Firebase Admin init failed:", e.message);
  console.error("   Run: firebase login && firebase use clockinsystem-55c67");
  console.error("   Or set GOOGLE_APPLICATION_CREDENTIALS to your service-account.json path");
  process.exit(1);
}

// ── API Key middleware ────────────────────────────────────────
async function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key) return res.status(401).json({ success: false, error: "Missing X-Api-Key header" });

  try {
    const snap = await db.collection("api_keys").doc(key).get();
    if (!snap.exists || snap.data().active !== true) {
      return res.status(401).json({ success: false, error: "Invalid or inactive API key" });
    }
    next();
  } catch (e) {
    return res.status(500).json({ success: false, error: "Key validation failed" });
  }
}

// ── Health check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "online", project: "MCT Clock-In", timestamp: new Date().toISOString() });
});

// ── POST /api/clockin  (ESP32 → this endpoint) ───────────────
app.post("/api/clockin", requireApiKey, async (req, res) => {
  const { rfid_uid, device_id = "ESP32", location = "Lab A" } = req.body;
  if (!rfid_uid) return res.status(400).json({ success: false, error: "rfid_uid required" });

  const uid = rfid_uid.toUpperCase();
  const now = new Date();

  try {
    // 1. Lookup student
    const studentSnap = await db.collection("students").doc(uid).get();

    if (!studentSnap.exists) {
      await db.collection("clockin_logs").add({
        rfid_uid: uid, status: "UNKNOWN", device_id, location,
        timestamp: FieldValue.serverTimestamp(),
        date: now.toLocaleDateString("en-NG"),
        time: now.toLocaleTimeString("en-NG"),
      });
      return res.json({
        success: true, status: "UNKNOWN",
        message: "Card not registered",
        display_message: "Unknown Card",
        buzzer: "error",
      });
    }

    const student = studentSnap.data();

    // 2. Duplicate check (last 5 minutes)
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const recentSnap = await db.collection("clockin_logs")
      .where("rfid_uid", "==", uid)
      .where("status", "==", "SUCCESS")
      .where("timestamp", ">=", fiveMinAgo)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      return res.json({
        success: true, status: "DUPLICATE",
        message: "Already clocked in recently",
        display_message: `Hi ${student.name.split(" ")[0]}! Already in.`,
        buzzer: "double",
        student,
      });
    }

    // 3. Write successful log
    const logRef = await db.collection("clockin_logs").add({
      rfid_uid: uid,
      status: "SUCCESS",
      student: { name: student.name, studentId: student.studentId, department: student.department },
      device_id, location,
      timestamp: FieldValue.serverTimestamp(),
      date: now.toLocaleDateString("en-NG"),
      time: now.toLocaleTimeString("en-NG"),
    });

    console.log(`[CLOCK-IN] ${student.name} (${uid}) @ ${now.toLocaleTimeString()}`);

    res.json({
      success: true, status: "SUCCESS",
      message: `${student.name} clocked in`,
      display_message: `Welcome, ${student.name.split(" ")[0]}!`,
      buzzer: "success",
      student, logId: logRef.id,
    });

  } catch (e) {
    console.error("Clock-in error:", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🎓 MCT Clock-In API Server`);
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`🔧 ESP32 should POST to: http://YOUR-IP:${PORT}/api/clockin\n`);
});