const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// =========================
// 🔐 ENV
// =========================
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// =========================
// 🚨 ENV 체크
// =========================
if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

// =========================
// 🌐 허용 도메인
// =========================
const allowedOrigins = [
  "http://www.waterbridgepartners.kr",
  "https://www.waterbridgepartners.kr"
];

// =========================
// 🔥 CORS (완전 안정 버전)
// =========================
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked:", origin);
    return callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

// 🔥 preflight 반드시 허용

app.use(express.json());

// =========================
// ⚡ Socket.IO (완전 안정)
// =========================
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true
  },

  // 🔥 핵심 수정 (polling 문제 해결)
  transports: ["polling", "websocket"]
});

// =========================
// 🟢 Health Check
// =========================
app.get("/", (req, res) => {
  res.status(200).send("WaterBridge Chat Server Running 🚀");
});

// =========================
// 📩 상담 → Telegram
// =========================
app.post("/send", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: "message required"
    });
  }

  // 먼저 응답
  res.json({ success: true });

  try {
    const text = `📩 새 상담\n\n세션: ${sessionId || "unknown"}\n\n내용:\n${message}`;

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text
      },
      { timeout: 5000 }
    );

  } catch (err) {
    console.error("❌ Telegram error:", err.message);
  }
});

// =========================
// 💬 Telegram → 프론트 전달
// =========================
app.post("/reply", (req, res) => {
  const { sessionId, text } = req.body;

  if (!sessionId || !text) {
    return res.status(400).json({
      success: false,
      error: "invalid payload"
    });
  }

  io.emit("telegramReply", { sessionId, text });

  res.json({ success: true });
});

// =========================
// 🔌 Socket 연결
// =========================
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

// =========================
// 🚀 Start Server
// =========================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`);
});