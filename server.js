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
  cors: { origin: "*" },
  pingTimeout: 60000,
});

/* ================= SAFE ENV CHECK ================= */
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MONGO_URL 없음 (Railway Variables 확인)");
  process.exit(1);
}

/* ================= DB CONNECT (STABLE) ================= */
mongoose.connect(MONGO_URL)
  .then(() => console.log("🟢 MongoDB 연결 성공"))
  .catch(err => {
    console.error("🔴 MongoDB 연결 실패:", err.message);
    process.exit(1);
  });

/* ================= MODELS ================= */
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
  console.log("🟢 socket connected");

  socket.on("join", (sessionId) => {
    if (!sessionId) return;
    socket.join(sessionId);
  });

  socket.on("message", async (data) => {
    try {
      const { sessionId, text, from } = data;
      if (!sessionId || !text) return;

      const msg = await Message.create({ sessionId, from, text });

      await Session.findOneAndUpdate(
        { sessionId },
        { sessionId, lastMessage: text, updatedAt: new Date() },
        { upsert: true }
      );

      io.to(sessionId).emit("message", msg);

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
      console.error("socket error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 socket disconnected");
  });
});

/* ================= AI ================= */
function aiEngine(text) {
  text = text.toLowerCase();

  if (text.includes("m&a")) return "M&A 전문 상담 가능합니다.";
  if (text.includes("투자")) return "투자유치 상담 가능합니다.";
  if (text.includes("비용")) return "프로젝트별 상이합니다.";
  if (text.includes("시간")) return "09:00~18:00 운영됩니다.";

  return "담당 상담원이 곧 연결됩니다.";
}

/* ================= API ================= */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/sessions", async (req, res) => {
  const list = await Session.find().sort({ updatedAt: -1 });
  res.json(list);
});

app.get("/messages/:sessionId", async (req, res) => {
  const msgs = await Message.find({ sessionId: req.params.sessionId });
  res.json(msgs);
});

app.post("/close", async (req, res) => {
  const { sessionId } = req.body;
  await Session.updateOne({ sessionId }, { status: "closed" });
  res.json({ ok: true });
});
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "public/admin.html");
});
/* ================= START ================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});