require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
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
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: { origin: allowedOrigins }
});

/* ================= MEMORY DB ================= */
const sessions = new Map();   // sessionId -> messages[]
const agents = new Map();     // socketId -> agent info

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

  // 상담원 등록
  socket.on("agent-online", () => {
    agents.set(socket.id, {
      status: "online",
      sessions: 0
    });

    socket.join("agents");
  });

  // 고객 입장
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
      status: "online"
    });
  });

  // 메시지 전달 (실시간 핵심)
  socket.on("message", (msg) => {

    const { sessionId, text, from } = msg;

    const data = {
      id: crypto.randomUUID(),
      sessionId,
      text,
      from,
      time: Date.now()
    };

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    sessions.get(sessionId).push(data);

    io.to(sessionId).emit("message", data);

    // 🔥 AI 자동응답 (상담원 없을 때만)
    if (from === "user") {

      setTimeout(() => {

        const ai = {
          id: crypto.randomUUID(),
          sessionId,
          from: "bot",
          text: autoAI(text),
          time: Date.now()
        };

        sessions.get(sessionId).push(ai);
        io.to(sessionId).emit("message", ai);

      }, 700);
    }
  });

  // 상담원 disconnect
  socket.on("disconnect", () => {
    if (agents.has(socket.id)) {
      agents.delete(socket.id);
    }

    console.log("DISCONNECT:", socket.id);
  });
});

/* ================= AI ================= */
function autoAI(text) {

  text = text.toLowerCase();

  if (text.includes("m&a")) return "M&A 전문 상담 가능합니다.";
  if (text.includes("투자")) return "투자유치/IR 상담 가능합니다.";
  if (text.includes("비용")) return "프로젝트별로 상이합니다.";
  if (text.includes("시간")) return "상담시간은 09:00~18:00 입니다.";

  return "전문 상담원이 곧 안내드립니다.";
}

/* ================= ADMIN API ================= */

// 메시지 히스토리
app.get("/messages/:sessionId", (req, res) => {
  res.json(sessions.get(req.params.sessionId) || []);
});

// 세션 목록
app.get("/sessions", (req, res) => {
  res.json(Array.from(sessions.keys()));
});

// 상담원 응답
app.post("/reply", (req, res) => {

  const { sessionId, text } = req.body;

  const msg = {
    id: crypto.randomUUID(),
    sessionId,
    text,
    from: "agent",
    time: Date.now()
  };

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  sessions.get(sessionId).push(msg);

  io.to(sessionId).emit("message", msg);

  res.json({ ok: true });
});

// 세션 종료
app.post("/end", (req, res) => {

  const { sessionId } = req.body;

  sessions.delete(sessionId);

  io.to(sessionId).emit("status", {
    status: "closed"
  });

  res.json({ ok: true });
});

/* ================= START ================= */
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 CHAT SERVER RUNNING:", PORT);
});