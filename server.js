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

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const io = new Server(server, {
  cors: { origin: "*" }
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

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("connect:", socket.id);

  // USER JOIN
  socket.on("user:join", async (sessionId) => {
  if (!sessionId) return;

  socket.data.sessionId = sessionId;

  socket.join(`session:${sessionId}`);

  console.log("USER JOIN:", sessionId);

  const history = await Message.find({ sessionId }).sort({ createdAt: 1 });
  socket.emit("chat:history", history);

  io.to("admins").emit("admin:user_online", { sessionId });
});

  // ADMIN JOIN
  socket.on("admin:join", () => {
    socket.join("admins");
  });

  // ADMIN WATCH (정리된 구조)
 socket.on("admin:watch", (sessionId) => {
  if (!sessionId) return;

  // 기존 session room 제거
  for (const room of socket.rooms) {
    if (room !== socket.id && room.startsWith("session:")) {
      socket.leave(room);
    }
  }

  socket.join(`session:${sessionId}`);
  socket.data.watchSession = sessionId;

  console.log("ADMIN WATCH:", sessionId);
});

  // USER MESSAGE
  socket.on("user:message", async ({ sessionId, text }) => {
    if (!sessionId || !text) return;

    const msg = await Message.create({
      sessionId,
      text,
      from: "user"
    });

    io.to(`session:${sessionId}`).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
  });

  // ADMIN MESSAGE
  socket.on("admin:message", async ({ sessionId, text, adminName }) => {
    if (!sessionId || !text) return;

    const msg = await Message.create({
      sessionId,
      text,
      from: "admin",
      adminName: adminName || "상담원"
    });

    io.to(`session:${sessionId}`).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("disconnect:", socket.id);
  });
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI);

  server.listen(process.env.PORT || 3000, () => {
    console.log("server running");
  });
}

start();