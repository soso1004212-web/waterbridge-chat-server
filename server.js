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
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ================== SOCKET ==================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("join", async (sessionId) => {
    socket.join(sessionId);

    // 🔥 채팅 히스토리 복구 (끊겨도 복구됨)
    const history = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(100);

    socket.emit("history", history);
  });

  socket.on("adminJoin", () => {
    socket.join("admin");
  });

  // ================= USER MESSAGE =================
  socket.on("message", async (data) => {
    try {
      const msg = await Message.create({
        sessionId: data.sessionId,
        text: data.text,
        from: data.from || "user"
      });

      io.to(data.sessionId).emit("message", msg);
      io.to("admin").emit("message", msg);
    } catch (err) {
      console.error("message error:", err);
    }
  });

  // ================= ADMIN MESSAGE =================
  socket.on("adminMessage", async (data) => {
    try {
      const msg = await Message.create({
        sessionId: data.sessionId,
        text: data.text,
        from: "admin"
      });

      io.to(data.sessionId).emit("message", msg);
      io.to("admin").emit("message", msg);
    } catch (err) {
      console.error("adminMessage error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
  });
});

// ================== API ==================
app.get("/admin/messages/:sessionId", async (req, res) => {
  const data = await Message.find({ sessionId: req.params.sessionId })
    .sort({ createdAt: 1 });

  res.json(data);
});

app.get("/admin/sessions", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 });

  const sessions = {};
  messages.forEach(m => {
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

// ================== START (안정형) ==================
async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log("✅ MongoDB connected");

    server.listen(process.env.PORT || 3000, () => {
      console.log("🚀 server running");
    });

  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

start();