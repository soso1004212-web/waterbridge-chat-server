const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
  cors: { origin: "*" }
});

server.listen(3000);


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

    // ✅ sessionId 안전 처리 (핵심 수정)
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

    // 👉 관리자 + 모든 클라이언트로 전송
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

    // 👉 고객 + 관리자 모두에게 전달
    io.emit("chat:message", msg);
  });



  // =====================
  // DEBUG (필수: 문제 찾기용)
  // =====================
  socket.onAny((event, data) => {
    console.log("EVENT:", event, data);
  });

});



// =====================
// ADMIN API - SESSION LIST
// =====================
app.get("/admin/sessions", (req, res) => {

  const list = Object.keys(sessions).map(sessionId => ({
    sessionId,
    lastMessage: sessions[sessionId]?.messages.slice(-1)[0]?.text || ""
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
// START SERVER
// =====================
server.listen(3000, () => {
  console.log("Server running on 3000");
});