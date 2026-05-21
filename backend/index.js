require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

const allowedOrigin = process.env.CLIENT_URL || "*";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

let messages = [];

app.get("/", (req, res) => {
  res.json({
    message: "Hello from the backend!",
    history: messages
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.emit("initial_messages", messages);

  socket.on("send_message", (messageText) => {
    const messageObject = {
      id: uuidv4(),
      message: messageText,
      likes: 0
    };
    messages.push(messageObject);
    io.emit("receive_message", messageObject);
  });

  
  socket.on("add_likes", (messageId) => {
    const message = messages.find(
      (m) => m.id === messageId
    );

    if (message) {message.likes += 1;

      console.log(`Message ${message.id} now has ${message.likes} likes`
      );

      io.emit("likes_updated",message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});