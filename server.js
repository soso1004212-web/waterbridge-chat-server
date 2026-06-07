const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// =========================
// 🔐 ENV (보안 핵심)
// =========================
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// =========================
// 🚨 필수 환경변수 체크
// =========================
if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ BOT_TOKEN 또는 CHAT_ID가 설정되지 않았습니다.");
  process.exit(1);
}

// =========================
// 🌐 CORS 설정
// =========================
const allowedOrigins = [
  "http://www.waterbridgepartners.kr",
  "https://www.waterbridgepartners.kr"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// =========================
// ⚡ Socket.IO 안정 설정
// =========================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// =========================
// 🟢 Health Check (Railway용 중요)
// =========================
app.get("/", (req, res) => {
  res.status(200).send("WaterBridge Chat Server Running 🚀");
});

// =========================
// 📩 상담 → Telegram 전송
// =========================
app.post("/send", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "message is required"
      });
    }

    // 먼저 응답 (UX 중요)
    res.json({ success: true });

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
    console.error("❌ /send error:", err.message);
  }
});

// =========================
// 💬 Telegram → 사용자 실시간 전달
// =========================
app.post("/reply", (req, res) => {
  try {
    const { sessionId, text } = req.body;

    if (!sessionId || !text) {
      return res.status(400).json({
        success: false,
        error: "invalid payload"
      });
    }

    io.emit("telegramReply", {
      sessionId,
      text
    });

    res.json({ success: true });

  } catch (err) {
    console.error("❌ /reply error:", err.message);
  }
});

// =========================
// 🔌 Socket 연결 관리
// =========================
io.on("connection", (socket) => {
  console.log("🟢 연결됨:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 연결 종료:", socket.id);
  });
});

// =========================
// 🚀 서버 실행
// =========================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});