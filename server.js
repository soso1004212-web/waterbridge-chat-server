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

  adminName: {
    type: String,
    default: ""
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Message", MessageSchema);
const onlineUsers = new Map();
// ================== SOCKET ==================
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

socket.on("join", async (sessionId) => {
  try {

    onlineUsers.set(socket.id, sessionId);

    io.to("admin").emit("userOnline", {
      sessionId
    });

    socket.join(sessionId);

    const history = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(100);

    socket.emit("history", history);

  } catch (err) {
    console.error("join error:", err);
  }
});

  socket.on("adminJoin", () => {
    socket.join("admin");
  });

  socket.on("message", async (data) => {
    try {
      const msg = await Message.create({
        sessionId: data.sessionId,
        text: data.text,
        from: data.from || "user",
      });

      io.to(data.sessionId).emit("message", msg);
      io.to("admin").emit("message", msg);
    } catch (err) {
      console.error("message error:", err);
    }
  });

socket.on("adminMessage", async (data) => {
  try {

    const msg = await Message.create({
      sessionId: data.sessionId,
      text: data.text,
      from: "admin",
      adminName: data.adminName || "상담원"
    });

    io.to(data.sessionId).emit("message", msg);
    io.to("admin").emit("message", msg);

  } catch (err) {
    console.error("adminMessage error:", err);
  }
});

socket.on("endChat", ({ sessionId }) => {

  io.to(sessionId).emit("chatEnded");

});

socket.on("disconnect", () => {

  const sessionId = onlineUsers.get(socket.id);

  if (sessionId) {

    io.to("admin").emit("userOffline", {
      sessionId
    });

    onlineUsers.delete(socket.id);
  }

  console.log("disconnected:", socket.id);
});

// ================== API ==================
app.get("/admin/messages/:sessionId", async (req, res) => {
  try {
    const data = await Message.find({
      sessionId: req.params.sessionId,
    }).sort({ createdAt: 1 });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/admin/sessions", async (req, res) => {
  try {
    const messages = await Message.find().sort({
      createdAt: -1,
    });

    const sessions = {};

    messages.forEach((m) => {
      if (!sessions[m.sessionId]) {
        sessions[m.sessionId] = {
          sessionId: m.sessionId,
          lastMessage: m.text,
          updatedAt: m.createdAt,
        };
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
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log(`🚀 server running on ${PORT}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

start();