require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
});

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("워터브릿지 채팅 서버 정상 작동 🚀");
});

/* ================= DB ================= */
const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error("❌ MONGO_URL 없음");
  process.exit(1);
}

mongoose.connect(MONGO_URL)
  .then(() => console.log("🟢 MongoDB 연결 성공"))
  .catch(err => {
    console.error("🔴 MongoDB 오류:", err.message);
    process.exit(1);
  });

/* ================= MODELS ================= */
const Message = mongoose.model("Message", new mongoose.Schema({
  sessionId: { type: String, index: true },
  from: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
}));

const Session = mongoose.model("Session", new mongoose.Schema({
  sessionId: { type: String, unique: true },
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
      if (!data?.sessionId || !data?.text) return;

      const { sessionId, text, from } = data;

      // 1. 메시지 저장
      const msg = await Message.create({
        sessionId,
        from,
        text
      });

      // 2. 세션 업데이트
      await Session.findOneAndUpdate(
        { sessionId },
        {
          sessionId,
          lastMessage: text,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // 3. 실시간 전송
      io.to(sessionId).emit("message", msg);

      // 4. AI 응답
      if (from === "user") {
        setTimeout(async () => {
          const aiText = aiEngine(text);

          const aiMsg = await Message.create({
            sessionId,
            from: "bot",
            text: aiText
          });

          await Session.findOneAndUpdate(
            { sessionId },
            {
              lastMessage: aiText,
              updatedAt: new Date()
            }
          );

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
function aiEngine(text = "") {
  text = text.toLowerCase();

  if (text.includes("m&a")) return "M&A 전문 상담 가능합니다.";
  if (text.includes("투자")) return "투자유치 상담 가능합니다.";
  if (text.includes("비용")) return "프로젝트별 상이합니다.";
  if (text.includes("시간")) return "09:00~18:00 운영됩니다.";

  return "담당 상담원이 곧 연결됩니다.";
}

/* ================= API ================= */

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* 🔥 세션 리스트 (관리자용) */
app.get("/admin/sessions", async (req, res) => {
  const list = await Session.find().sort({ updatedAt: -1 });
  res.json(list);
});

/* 🔥 메시지 리스트 */
app.get("/admin/messages/:sessionId", async (req, res) => {
  const msgs = await Message.find({ sessionId: req.params.sessionId })
    .sort({ createdAt: 1 });

  res.json(msgs);
});

/* 세션 종료 */
app.post("/close", async (req, res) => {
  const { sessionId } = req.body;

  await Session.updateOne(
    { sessionId },
    { status: "closed" }
  );

  res.json({ ok: true });
});

/* ================= ADMIN PAGE ================= */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});