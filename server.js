require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

/* ================= ENV ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

/* ================= SAFE CHECK ================= */
if (!BOT_TOKEN || !CHAT_ID) {
  console.log("❌ Missing BOT_TOKEN or CHAT_ID (Telegram disabled)");
}

/* ================= CORS ================= */
const allowedOrigins = [
  "http://www.waterbridgepartners.kr",
  "https://www.waterbridgepartners.kr"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

/* ================= MEMORY DB (SaaS CORE) ================= */
const sessions = new Map();   // sessionId → messages[]
const sessionMeta = new Map(); // sessionId → metadata

/* ================= SOCKET CONNECT ================= */
io.on("connection", (socket) => {

  console.log("🟢 CONNECT:", socket.id);

  /* 고객 join */
  socket.on("join", (sessionId) => {
    socket.join(sessionId);

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    if (!sessionMeta.has(sessionId)) {
      sessionMeta.set(sessionId, {
        createdAt: Date.now(),
        status: "active"
      });
    }

    console.log("📌 JOIN:", sessionId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 DISCONNECT:", socket.id);
  });
});

/* ================= USER SEND ================= */
app.post("/send", async (req, res) => {

  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "invalid request" });
  }

  console.log("🔥 USER MESSAGE:", sessionId, message);

  /* 저장 */
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  sessions.get(sessionId).push({
    from: "user",
    text: message,
    time: Date.now()
  });

  /* realtime send */
  io.to(sessionId).emit("message", {
    from: "user",
    text: message,
    sessionId
  });

  /* Telegram (optional safe) */
  if (BOT_TOKEN && CHAT_ID) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          chat_id: CHAT_ID,
          text: `📩 상담 요청\n\nID: ${sessionId}\n내용:\n${message}`
        },
        { timeout: 5000 }
      );

      console.log("✅ TELEGRAM SENT");

    } catch (err) {
      console.log("❌ TELEGRAM ERROR:", err.message);
    }
  }

  res.json({ ok: true });
});

/* ================= ADMIN REPLY ================= */
app.post("/reply", (req, res) => {

  const { sessionId, text } = req.body;

  if (!sessionId || !text) {
    return res.status(400).json({ error: "invalid request" });
  }

  console.log("💬 ADMIN:", sessionId, text);

  /* 저장 */
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  sessions.get(sessionId).push({
    from: "admin",
    text,
    time: Date.now()
  });

  /* realtime send */
  io.to(sessionId).emit("message", {
    from: "admin",
    text,
    sessionId
  });

  res.json({ success: true });
});

/* ================= SESSIONS LIST ================= */
app.get("/sessions", (req, res) => {
  const list = Array.from(sessions.keys()).map(id => ({
    sessionId: id,
    lastMessage: sessions.get(id)?.slice(-1)[0] || null,
    meta: sessionMeta.get(id) || {}
  }));

  res.json(list);
});

/* ================= MESSAGES ================= */
app.get("/messages/:sessionId", (req, res) => {

  const { sessionId } = req.params;

  res.json(sessions.get(sessionId) || []);
});

/* ================= ADMIN PAGE ================= */
const path = require("path");

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});
/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("🚀 Zendesk-lite SaaS Running");
});

/* ================= START ================= */
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SAAS SERVER RUNNING ON", PORT);
});