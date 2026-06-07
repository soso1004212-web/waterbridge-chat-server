const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

console.log("BOOT START");
console.log("BOT:", !!process.env.BOT_TOKEN);
console.log("CHAT:", !!process.env.CHAT_ID);
const PORT = process.env.PORT || 3000;

// 🔐 ENV 체크 (임시 주석 테스트 가능)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const allowedOrigins = [
  "http://www.waterbridgepartners.kr",
  "https://www.waterbridgepartners.kr"
];

// ================= CORS =================
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

// ❌ 이거 절대 넣지 마
// app.options("*", cors());  ← 삭제

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("OK");
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on", PORT);
});