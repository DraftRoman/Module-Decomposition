require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
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

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});