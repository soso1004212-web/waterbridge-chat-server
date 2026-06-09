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

// ================== STATIC ==================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Chat Server Running");
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
});

// ================== DB CHECK ==================
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing");
  process.exit(1);
}

// ================== MODEL ==================
const MessageSchema = new mongoose.Schema({
  sessionId: String,
  text: String,
  from: String,
  adminName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

const onlineUsers = new Map();

// ================== SOCKET ==================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("join", async (sessionId) => {
    onlineUsers.set(socket.id, sessionId);

    socket.join(sessionId);

    io.to("admin").emit("userOnline", { sessionId });

    const history = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(100);

    socket.emit("history", history);
  });

  socket.on("adminJoin", () => {
    socket.join("admin");
  });

  socket.on("message", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "user"
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });

  socket.on("adminMessage", async (data) => {
    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "admin",
      adminName: data.adminName || "상담원"
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);
  });

  socket.on("endChat", ({ sessionId }) => {
    io.to(sessionId).emit("chatEnded");
  });

  socket.on("disconnect", () => {
    const sessionId = onlineUsers.get(socket.id);
    if (sessionId) {
      io.to("admin").emit("userOffline", { sessionId });
      onlineUsers.delete(socket.id);
    }
  });
});

// ================== API ==================
app.get("/admin/messages/:sessionId", async (req, res) => {
  const data = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
  res.json(data);
});

app.get("/admin/sessions", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 });

  const sessions = {};
  messages.forEach((m) => {
    if (!sessions[m.sessionId]) {
      sessions[m.sessionId] = {
        sessionId: m.sessionId,
        lastMessage: m.text,
        updatedAt: m.createdAt
      };
    }
  });

  res.json(Object.values(sessions));
});
app.delete("/admin/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await Message.deleteMany({ sessionId });
    await Session.deleteOne({ sessionId }); // Session 모델 없으면 이 줄 삭제

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
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