const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ===== 환경변수 =====
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ===== CORS =====
app.use(cors({
  origin: [
    "http://www.waterbridgepartners.kr",
    "https://www.waterbridgepartners.kr"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// ===== Socket.IO =====
const io = new Server(server, {
  cors: {
    origin: [
      "http://www.waterbridgepartners.kr",
      "https://www.waterbridgepartners.kr"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ===== 기본 체크 =====
app.get("/", (req, res) => {
  res.send("WaterBridge Chat Server Running");
});

// ===== 상담 메시지 → Telegram =====
app.post("/send", (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: "no message" });
  }

  // 먼저 응답 (중요)
  res.json({ success: true });

  axios.post(`https://api.telegram.org/bot${8881120675:AAHVuJ7RnhHBhcEVog0wRBzqNDXqvO1ArRE}/sendMessage`, {
    chat_id: 8643867290,
    text: `📩 새 상담\n\n세션: ${sessionId}\n\n내용:\n${message}`
  }).catch(err => {
    console.log("텔레그램 오류:", err.message);
  });
});

// ===== Telegram → 프론트 실시간 전달 =====
app.post("/reply", (req, res) => {
  const { sessionId, text } = req.body;

  io.emit("telegramReply", {
    sessionId,
    text
  });

  res.json({ success: true });
});

// ===== Socket 연결 =====
io.on("connection", (socket) => {
  console.log("🔵 사용자 연결됨:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 사용자 종료:", socket.id);
  });
});

// ===== 서버 실행 =====
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 서버 실행중:", PORT);
});