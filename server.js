const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

app.use(cors({
  origin: "*"
}));
app.use(express.json());

const BOT_TOKEN = "8881120675:AAHVuJ7RnhHBhcEVog0wRBzqNDXqvO1ArRE";
const CHAT_ID = "8643867290";

app.get("/", (req, res) => {
  res.send("WaterBridge Chat Server Running");
});

app.post("/send", async (req, res) => {

  const { message, sessionId } = req.body;

  // 👉 먼저 응답 (서버 안 멈추게)
  res.json({ success: true });

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: `📩 새 상담\n\n세션: ${sessionId}\n\n내용:\n${message}`
      }
    );
  } catch (err) {
    console.log("텔레그램 오류:", err.message);
  }

});

app.post("/reply", (req, res) => {

  const { sessionId, text } = req.body;

  io.emit("telegramReply", {
    sessionId,
    text
  });

  res.json({
    success: true
  });

});

io.on("connection", (socket) => {

  console.log("🔵 사용자 연결됨:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 사용자 종료");
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("서버 실행중", PORT);
});