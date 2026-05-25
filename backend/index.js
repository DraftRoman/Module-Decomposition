require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://front-with-database.178.105.39.91.sslip.io",
  "https://front-with-database.178.105.39.91.sslip.io"
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["polling","websocket"]
});


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);


app.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json(error);

  res.json({ messages: data });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  socket.emit("initial_messages", data || []);

  socket.on("send_message", async (messageData) => {
    const { message, user_id, author } = messageData;

    const { data, error } = await supabase
      .from("messages")
      .insert([{ message, user_id, author }])
      .select()
      .single();

    if (!error) io.emit("receive_message", data);
  });

  socket.on("add_likes", async (id) => {
    const { data } = await supabase
      .from("messages")
      .select("likes")
      .eq("id", id)
      .single();

    const { data: updated } = await supabase
      .from("messages")
      .update({ likes: (data.likes || 0) + 1 })
      .eq("id", id)
      .select()
      .single();

    io.emit("likes_updated", updated);
  });

  socket.on("add_dislikes", async (id) => {
    const { data } = await supabase
      .from("messages")
      .select("dislikes")
      .eq("id", id)
      .single();

    const { data: updated } = await supabase
      .from("messages")
      .update({ dislikes: (data.dislikes || 0) + 1 })
      .eq("id", id)
      .select()
      .single();

    io.emit("dislikes_updated", updated);
  });

  socket.on("delete", async (id) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id);

    if (!error) {
      io.emit("message_deleted", id);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});