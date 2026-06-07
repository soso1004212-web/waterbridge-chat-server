const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "http://www.waterbridgepartners.kr",
    "https://www.waterbridgepartners.kr"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ================= ROOM JOIN =================
io.on("connection", (socket) => {

  console.log("USER CONNECT:", socket.id);

  socket.on("join", (sessionId) => {
    socket.join(sessionId);
    console.log("JOIN ROOM:", sessionId);
  });

  socket.on("disconnect", () => {
    console.log("DISCONNECT:", socket.id);
  });
});

// ================= USER → ADMIN =================
app.post("/send", (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "invalid" });
  }

  console.log("USER MSG:", sessionId, message);

  // 👉 Telegram 보내기 (옵션)
  // axios.post(...)

  res.json({ success: true });
});

// ================= ADMIN → USER =================
app.post("/reply", (req, res) => {
  const { sessionId, text } = req.body;

  if (!sessionId || !text) {
    return res.status(400).json({ error: "invalid" });
  }

  console.log("ADMIN REPLY:", sessionId, text);

  // 🔥 핵심: 특정 사용자에게 즉시 전달
  io.to(sessionId).emit("reply", {
    text
  });

  res.json({ success: true });
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("OK - Live Chat Running");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON", PORT);
});