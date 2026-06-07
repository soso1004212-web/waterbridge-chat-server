require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

/* ================= ENV ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

/* ================= CORS ================= */
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

/* ================= STATIC FILE ================= */
// public 폴더 사용 (권장)
app.use(express.static(path.join(__dirname, "public")));

/* ================= ADMIN PAGE ================= */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: { origin: allowedOrigins }
});

/* ================= DB ================= */
const sessions = new Map();
const agents = new Map();

/* ================= UTIL ================= */
function getLeastBusyAgent() {
  let best = null;
  let min = Infinity;

  for (const [id, agent] of agents.entries()) {
    if (agent.status !== "online") continue;
    if (agent.sessions < min) {
      min = agent.sessions;
      best = id;
    }
  }

  return best;
}

/* ================= SOCKET ================= */
io.on("connection", (socket) => {

  console.log("CONNECT:", socket.id);

  socket.on("agent-online", () => {
    agents.set(socket.id, {
      status: "online",
      sessions: 0
    });
  });

  socket.on("join", (sessionId) => {

    socket.join(sessionId);

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    const agentId = getLeastBusyAgent();

    if (agentId) {
      agents.get(agentId).sessions++;

      io.to(agentId).emit("new-session", {
        sessionId
      });
    }

    io.to(sessionId).emit("status", {
      sessionId,
      status: "online"
    });
  });

  socket.on("disconnect", () => {
    agents.delete(socket.id);
  });
});

/* ================= USER SEND ================= */
app.post("/send", async (req, res) => {

  const { message, sessionId } = req.body;

  const msg = {
    id: crypto.randomUUID(),
    from: "user",
    text: message,
    sessionId,
    time: Date.now(),
    read: false
  };

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  sessions.get(sessionId).push(msg);

  io.to(sessionId).emit("message", msg);

  /* AI 자동응답 */
  let aiText = null;

  if (message.includes("시간")) aiText = "상담시간은 09:00~18:00 입니다.";
  if (message.includes("대출")) aiText = "담당자가 곧 연결됩니다.";

  if (aiText) {
    setTimeout(() => {

      const botMsg = {
        id: crypto.randomUUID(),
        from: "bot",
        text: aiText,
        sessionId,
        time: Date.now(),
        read: true
      };

      sessions.get(sessionId).push(botMsg);
      io.to(sessionId).emit("message", botMsg);

    }, 800);
  }

  res.json({ ok: true, id: msg.id });
});

/* ================= ADMIN REPLY ================= */
app.post("/reply", (req, res) => {

/* ================= END SESSION ================= */
app.post("/end", (req, res) => {

  const { sessionId } = req.body;

  if (!sessions.has(sessionId)) {
    return res.json({ ok: false, message: "no session" });
  }

  const history = sessions.get(sessionId);

  // (선택) 로그 저장
  console.log("=== SESSION END ===");
  console.log("ID:", sessionId);
  console.log("HISTORY:", history);

  // 실제 종료 처리
  sessions.delete(sessionId);

  res.json({ ok: true });
});

  const { sessionId, text } = req.body;

  const msg = {
    id: crypto.randomUUID(),
    from: "admin",
    text,
    sessionId,
    time: Date.now(),
    read: true
  };

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  sessions.get(sessionId).push(msg);

  io.to(sessionId).emit("message", msg);

  res.json({ ok: true, id: msg.id });
});

/* ================= API ================= */
app.get("/sessions", (req, res) => {
  res.json(Array.from(sessions.keys()));
});

app.get("/messages/:id", (req, res) => {
  res.json(sessions.get(req.params.id) || []);
});

/* ================= START ================= */
server.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER RUNNING:", PORT);
});