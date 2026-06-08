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

// ================== ROUTE ==================
app.get("/", (req, res) => {
  res.send("Chat Server Running");
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ================== SOCKET ==================
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000
});

// ================== DB ==================
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing");
  process.exit(1);
}

// ================== MODEL ==================
const MessageSchema = new mongoose.Schema({
  sessionId: String,
  text: String,
  from: String,
  adminName: { type: String, default: "" },

  readByAdmin: { type: Boolean, default: false },
  readByUser: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ================== ONLINE MAP ==================
const onlineUsers = new Map();

// ================== SOCKET ==================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // 유저 join
  socket.on("join", async (sessionId) => {
    onlineUsers.set(socket.id, sessionId);
    socket.join(sessionId);

    io.to("admin").emit("userOnline", { sessionId });

    const history = await Message.find({ sessionId }).sort({ createdAt: 1 });
    socket.emit("history", history);
  });

  // 관리자 join
  socket.on("adminJoin", () => {
    socket.join("admin");
  });

  // 유저 메시지
  socket.on("message", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "user"
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });

  // 관리자 메시지
  socket.on("adminMessage", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "admin",
      adminName: data.adminName || "상담원",
      readByUser: false
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });

  // 상담 종료
  socket.on("endChat", ({ sessionId }) => {
    io.to(sessionId).emit("chatEnded");
  });

  // disconnect
  socket.on("disconnect", () => {
    const sessionId = onlineUsers.get(socket.id);

    if (sessionId) {
      io.to("admin").emit("userOffline", { sessionId });
      onlineUsers.delete(socket.id);
    }

    console.log("disconnected:", socket.id);
  });
});

// ================== ADMIN MESSAGES ==================
app.get("/admin/messages/:sessionId", async (req, res) => {
  const data = await Message.find({
    sessionId: req.params.sessionId
  }).sort({ createdAt: 1 });

  res.json(data);
});

// ================== READ API ==================
app.post("/message/read", async (req, res) => {
  try {
    const { sessionId, reader } = req.body;

    if (reader === "admin") {
      await Message.updateMany(
        { sessionId, from: "user" },
        { $set: { readByAdmin: true } }
      );
    }

    if (reader === "user") {
      await Message.updateMany(
        { sessionId, from: "admin" },
        { $set: { readByUser: true } }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "read failed" });
  }
});

// ================== SESSIONS ==================
app.get("/admin/sessions", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });

    const sessions = {};

    messages.forEach((m) => {
      if (!sessions[m.sessionId]) {
        sessions[m.sessionId] = {
          sessionId: m.sessionId,
          lastMessage: m.text,
          updatedAt: m.createdAt,
          unread: 0
        };
      }

      if (m.from === "user" && !m.readByAdmin) {
        sessions[m.sessionId].unread += 1;
      }
    });

    res.json(Object.values(sessions));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// ================== START ==================
async function start() {
  await mongoose.connect(process.env.MONGO_URI);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log("🚀 server running on", PORT);
  });
}

start();