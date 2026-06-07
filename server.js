require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

/* ================= CORS ================= */
const allowedOrigins = [
  "http://www.waterbridgepartners.kr",
  "https://www.waterbridgepartners.kr"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: { origin: allowedOrigins }
});

/* ================= MEMORY DB ================= */
const sessions = new Map(); // sessionId -> messages
const agents = new Map();   // admin socket

/* ================= UTIL ================= */
function aiReply(text) {
  text = text.toLowerCase();

  if (text.includes("m&a")) return "M&A 전문 상담 가능합니다.";
  if (text.includes("투자")) return "투자유치/IR 상담 가능합니다.";
  if (text.includes("비용")) return "프로젝트별로 상이합니다.";
  if (text.includes("시간")) return "상담시간은 09:00~18:00 입니다.";

  return "전문 상담원이 곧 안내드립니다.";
}

/* ================= SOCKET CORE ================= */
io.on("connection", (socket) => {

  console.log("CONNECT:", socket.id);

  /* ===== 상담원 등록 ===== */
  socket.on("agent-online", () => {
    agents.set(socket.id, { status: "online" });
    socket.join("agents");
  });

  /* ===== 고객 입장 ===== */
  socket.on("join", (sessionId) => {

    socket.join(sessionId);

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    io.to(sessionId).emit("status", { status: "online" });

    io.to("agents").emit("new-session", { sessionId });
  });

  /* ===== 메시지 ===== */
  socket.on("message", (data) => {

    const { sessionId, text, from } = data;

    const msg = {
      id: crypto.randomUUID(),
      sessionId,
      text,
      from,
      time: Date.now()
    };

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    sessions.get(sessionId).push(msg);

    io.to(sessionId).emit("message", msg);

    /* ===== AI (user만) ===== */
    if (from === "user") {

      setTimeout(() => {

        const bot = {
          id: crypto.randomUUID(),
          sessionId,
          text: aiReply(text),
          from: "bot",
          time: Date.now()
        };

        sessions.get(sessionId).push(bot);
        io.to(sessionId).emit("message", bot);

      }, 600);
    }
  });

  socket.on("disconnect", () => {
    agents.delete(socket.id);
  });
});

/* ================= API ================= */
app.get("/messages/:sessionId", (req, res) => {
  res.json(sessions.get(req.params.sessionId) || []);
});

app.get("/sessions", (req, res) => {
  res.json(Array.from(sessions.keys()));
});

/* ================= START ================= */
server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING:", PORT);
});