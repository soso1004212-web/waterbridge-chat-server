(function () {

const socket = io("https://YOUR-SERVER.com");

let sessionId = localStorage.getItem("sid");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem("sid", sessionId);
}

socket.emit("join", sessionId);

function send(text) {
  socket.emit("message", {
    sessionId,
    text,
    from: "user"
  });
}

window.WBChat = { send };

})();