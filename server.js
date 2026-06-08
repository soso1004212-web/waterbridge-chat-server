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

// ================= DB =================
mongoose.connect(process.env.MONGO_URI);

// ================= MODEL =================
const MessageSchema = new mongoose.Schema({
  sessionId: String,
  text: String,
  from: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // 세션 참여
  socket.on("join", (sessionId) => {
    socket.join(sessionId);
  });

  // 관리자 입장
  socket.on("adminJoin", () => {
    socket.join("admin");
  });

  // ================= USER MESSAGE =================
  socket.on("message", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: data.from || "user"
    });

    // 🔥 해당 세션 + 관리자 모두 전달
    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });

  // ================= ADMIN MESSAGE =================
  socket.on("adminMessage", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "admin"
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });
});

// ================= REST =================
app.get("/admin/messages/:sessionId", async (req, res) => {
  const data = await Message.find({ sessionId: req.params.sessionId });
  res.json(data);
});

app.get("/admin/sessions", async (req, res) => {
  const messages = await Message.find();

  const sessions = {};
  messages.forEach(m => {
    sessions[m.sessionId] = {
      sessionId: m.sessionId,
      lastMessage: m.text
    };
  });

  res.json(Object.values(sessions));
});

// ================= START =================
server.listen(process.env.PORT || 3000, () => {
  console.log("server running");
});