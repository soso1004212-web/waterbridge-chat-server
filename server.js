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
app.use(express.static(path.join(__dirname, "public")));

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000
});

// ================= DB =================
const MessageSchema = new mongoose.Schema({
  sessionId: String,
  text: String,
  from: String,
  adminName: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ================= MEMORY =================
const sessions = new Map(); // sessionId → socketId
const admins = new Set();    // admin socket list

// ================= CORE SOCKET =================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // ================= USER CONNECT =================
  socket.on("user:join", async (sessionId) => {
    if (!sessionId) return;

    // 🔥 기존 room 전부 제거 (중복 방지 핵심)
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room);
      }
    }

    socket.data.sessionId = sessionId;
    socket.join(sessionId);

    sessions.set(sessionId, socket.id);

    io.to("admins").emit("admin:user_online", { sessionId });

    const history = await Message.find({ sessionId }).sort({ createdAt: 1 });
    socket.emit("chat:history", history);
  });

  // ================= ADMIN JOIN =================
  socket.on("admin:join", () => {
    socket.join("admins");
    admins.add(socket.id);
  });

  // ================= USER MESSAGE =================
  socket.on("user:message", async ({ sessionId, text }) => {
    if (!sessionId || !text) return;

    const msg = await Message.create({
      sessionId,
      text,
      from: "user"
    });

    io.to(sessionId).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
  });

  // ================= ADMIN MESSAGE =================
  socket.on("admin:message", async ({ sessionId, text, adminName }) => {
    if (!sessionId || !text) return;

    const msg = await Message.create({
      sessionId,
      text,
      from: "admin",
      adminName: adminName || "상담원"
    });

    io.to(sessionId).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
  });

  // ================= SESSION LEAVE =================
  socket.on("session:leave", () => {
    const sessionId = socket.data.sessionId;
    if (sessionId) {
      socket.leave(sessionId);
      socket.data.sessionId = null;
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId;

    if (sessionId) {
      sessions.delete(sessionId);
      io.to("admins").emit("admin:user_offline", { sessionId });
    }

    admins.delete(socket.id);
    console.log("disconnected:", socket.id);
  });
});

// ================= START =================
async function start() {
  await mongoose.connect(process.env.MONGO_URI);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log("🚀 SaaS Chat Server running on", PORT);
  });
}

start();