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

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing ENV");
  process.exit(1);
}

// =========================
// 🌐 CORS
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
// ⚡ SOCKET.IO
// =========================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// =========================
// 🟢 HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.send("OK - Chat Server Running");
});

// =========================
// 📩 사용자 → Telegram
// =========================
app.post("/send", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ success: false });
  }

  res.json({ success: true });

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: `📩 상담 요청\n\nID: ${sessionId}\n내용:\n${message}`
      }
    );
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
});

// =========================
// 💬 Telegram → 사용자
// =========================
// 관리자 메시지를 특정 sessionId로 전달
app.post("/reply", (req, res) => {
  const { sessionId, text } = req.body;

  if (!sessionId || !text) {
    return res.status(400).json({ success: false });
  }

  io.to(sessionId).emit("reply", { text });

  res.json({ success: true });
});

// =========================
// 🔌 SOCKET CONNECTION
// =========================
io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  // session room 등록
  socket.on("join", (sessionId) => {
    socket.join(sessionId);
    console.log("join room:", sessionId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 disconnected:", socket.id);
  });
});

// =========================
// 🚀 START
// =========================
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 running on", PORT);
});