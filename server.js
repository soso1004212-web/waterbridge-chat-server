const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

// =====================
// MEMORY DB
// =====================
const sessions = {};
/*
sessions = {
  sessionId: {
    messages: []
  }
}
*/

// =====================
// SOCKET CONNECTION
// =====================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // =====================
  // USER MESSAGE
  // =====================
  socket.on("user:message", (data) => {
    const sessionId = data.sessionId || socket.id;
    const text = data.text;

    if (!text) return;

    if (!sessions[sessionId]) {
      sessions[sessionId] = { messages: [] };
    }

    const msg = {
      sessionId,
      text,
      from: "user",
      time: Date.now()
    };

    sessions[sessionId].messages.push(msg);

    io.emit("chat:message", msg);
  });

  // =====================
  // ADMIN MESSAGE
  // =====================
  socket.on("admin:message", (data) => {
    const sessionId = data.sessionId;
    const text = data.text;

    if (!sessionId || !text) return;

    if (!sessions[sessionId]) {
      sessions[sessionId] = { messages: [] };
    }

    const msg = {
      sessionId,
      text,
      from: "admin",
      time: Date.now()
    };

    sessions[sessionId].messages.push(msg);

    io.emit("chat:message", msg);
  });

  // =====================
  // DEBUG
  // =====================
  socket.onAny((event, data) => {
    console.log("EVENT:", event, data);
  });
});

// =====================
// ADMIN API - SESSION LIST
// =====================
app.get("/admin/sessions", (req, res) => {
  const list = Object.keys(sessions).map((sessionId) => ({
    sessionId,
    lastMessage:
      sessions[sessionId]?.messages.slice(-1)[0]?.text || ""
  }));

  res.json(list);
});

// =====================
// ADMIN API - MESSAGES
// =====================
app.get("/admin/messages/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  res.json(sessions[sessionId]?.messages || []);
});

// =====================
// START SERVER (ONLY ONCE)
// =====================
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});