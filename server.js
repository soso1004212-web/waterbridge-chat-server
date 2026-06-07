const express = require("express");
const cors = require("cors");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ================= ENV =================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("❌ Missing BOT_TOKEN or CHAT_ID");
}

// ================= CORS =================
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

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ================= CONNECTION =================
io.on("connection", (socket) => {

  console.log("USER CONNECT:", socket.id);

  socket.on("join", (sessionId) => {
    socket.join(sessionId);
    console.log("JOIN ROOM:", sessionId);
  });

  socket.on("disconnect", () => {
    console.log("DISCONNECT:", socket.id);
  });
});

// ================= USER → SERVER → TELEGRAM =================
app.post("/send", async (req, res) => {

  console.log("🔥 SEND HIT");

  const { message, sessionId } = req.body;

  console.log("BODY:", req.body);

  if (!message || !sessionId) {
    return res.status(400).json({ error: "invalid" });
  }

  try {
    if (process.env.BOT_TOKEN && process.env.CHAT_ID) {

      const result = await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.CHAT_ID,
          text: `📩 상담 요청\n\nID: ${sessionId}\n내용:\n${message}`
        }
      );

      console.log("✅ TELEGRAM OK");
      console.log(result.data);

    } else {
      console.log("❌ ENV MISSING");
    }

  } catch (err) {
    console.log("❌ TELEGRAM FAIL:", err.response?.data || err.message);
  }

  res.json({ ok: true });
});

// ================= ADMIN → USER =================
app.post("/reply", (req, res) => {
  const { sessionId, text } = req.body;

  if (!sessionId || !text) {
    return res.status(400).json({ error: "invalid" });
  }

  console.log("ADMIN REPLY:", sessionId, text);

  // 🔥 실시간 전달
  io.to(sessionId).emit("reply", {
    text
  });

  res.json({ success: true });
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("OK - Live Chat Running 🚀");
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON", PORT);
});