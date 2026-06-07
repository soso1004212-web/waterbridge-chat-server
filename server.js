const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

const BOT_TOKEN = "8881120675:AAHVuJ7RnhHBhcEVog0wRBzqNDXqvO1ArRE";
const CHAT_ID = "8643867290";

app.get("/", (req, res) => {
  res.send("WaterBridge Chat Server Running");
});

app.post("/send", async (req, res) => {

  try {

    const { message, sessionId } = req.body;

    console.log("============");
    console.log("새 상담 접수");
    console.log("세션:", sessionId);
    console.log("내용:", message);
    console.log("============");

    const result = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text:
`📩 새 상담

세션: ${sessionId}

내용:
${message}`
      }
    );

    console.log("텔레그램 전송 성공");

    res.json({
      success: true
    });

  } catch (err) {

    console.log("텔레그램 오류");

    if (err.response) {
      console.log(err.response.data);
    } else {
      console.log(err.message);
    }

    res.status(500).json({
      success: false
    });

  }

});

app.post("/reply", (req, res) => {

  const { sessionId, text } = req.body;

  io.emit("telegramReply", {
    sessionId,
    text
  });

  res.json({
    success: true
  });

});

io.on("connection", (socket) => {

  console.log("사용자 연결");

  socket.on("disconnect", () => {
    console.log("사용자 종료");
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`서버 실행중 ${PORT}`);
});
