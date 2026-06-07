require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ================= ENV CHECK ================= */
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  throw new Error("❌ MONGO_URL이 설정되지 않았습니다 (Railway Variables 확인)");
}

/* ================= DB CONNECT ================= */
mongoose.connect(MONGO_URL)
  .then(() => console.log("🟢 MongoDB 연결 성공"))
  .catch(err => {
    console.error("🔴 MongoDB 연결 실패:", err);
    process.exit(1);
  });

mongoose.connection.on("error", err => {
  console.error("Mongo Error:", err);
});

const Message = mongoose.model("Message", new mongoose.Schema({
  sessionId: String,
  from: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
}));

const Session = mongoose.model("Session", new mongoose.Schema({
  sessionId: String,
  status: { type: String, default: "open" },
  lastMessage: String,
  updatedAt: { type: Date, default: Date.now }
}));

/* ================= SOCKET ================= */
io.on("connection", (socket) => {

  socket.on("join", (sessionId) => {
    if (!sessionId) return;
    socket.join(sessionId);
  });

  socket.on("message", async (data) => {
    try {
      const { sessionId, text, from } = data;

      if (!sessionId || !text) return;

      const msg = await Message.create({
        sessionId,
        from,
        text
      });

      await Session.findOneAndUpdate(
        { sessionId },
        {
          sessionId,
          lastMessage: text,
          updatedAt: new Date(),
          status: "open"
        },
        { upsert: true }
      );

      io.to(sessionId).emit("message", msg);

      /* ================= AI ================= */
      if (from === "user") {
        setTimeout(async () => {

          const aiText = aiEngine(text);

          const aiMsg = await Message.create({
            sessionId,
            from: "bot",
            text: aiText
          });

          io.to(sessionId).emit("message", aiMsg);

        }, 600);
      }

    } catch (err) {
      console.error("Socket message error:", err);
    }
  });

});

/* ================= AI ENGINE ================= */
function aiEngine(text) {
  text = text.toLowerCase();

  if (text.includes("m&a")) return "M&A 전문 상담 가능합니다.";
  if (text.includes("투자")) return "투자유치 상담 가능합니다.";
  if (text.includes("비용")) return "프로젝트별 상이합니다.";
  if (text.includes("시간")) return "09:00~18:00 운영됩니다.";

  return "담당 상담원이 곧 연결됩니다.";
}

/* ================= ADMIN API ================= */

// 전체 세션
app.get("/admin/sessions", async (req, res) => {
  const sessions = await Session.find().sort({ updatedAt: -1 });
  res.json(sessions);
});

// 특정 세션 메시지
app.get("/admin/messages/:sessionId", async (req, res) => {
  const msgs = await Message.find({ sessionId: req.params.sessionId })
    .sort({ createdAt: 1 });

  res.json(msgs);
});

// 세션 종료
app.post("/admin/close", async (req, res) => {
  const { sessionId } = req.body;

  await Session.updateOne(
    { sessionId },
    { status: "closed", updatedAt: new Date() }
  );

  res.json({ ok: true });
});

// 헬스체크
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "chat-server" });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Chat Server Running on ${PORT}`);
});