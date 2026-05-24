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
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------------------- REST --------------------

app.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ messages: data || [] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Unable to fetch messages" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// -------------------- SOCKET --------------------

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    socket.emit("initial_messages", data || []);
  } catch (err) {
    console.error("Initial fetch error:", err.message);
  }

  // ---------------- SEND MESSAGE ----------------
  socket.on("send_message", async (messageData) => {
    try {
      const { message, user_id, author } = messageData;
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            message,
            user_id,
            author,
            likes: 0,
            dislikes: 0
          }
        ])
        .select()
        .single();
      if (error) throw error;
      io.emit("receive_message", data);
    } catch (err) {
      console.error("Send message error:", err.message);
    }
  });

  // ---------------- LIKES ----------------
  socket.on("add_likes", async (messageId) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("likes")
        .eq("id", messageId)
        .single();

      if (error) throw error;

      const { data: updated, error: updateError } = await supabase
        .from("messages")
        .update({ likes: (data.likes || 0) + 1 })
        .eq("id", messageId)
        .select()
        .single();

      if (updateError) throw updateError;

      io.emit("likes_updated", updated);
    } catch (err) {
      console.error("Likes error:", err.message);
    }
  });

  // ---------------- DISLIKES ----------------
  socket.on("add_dislikes", async (messageId) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("dislikes")
        .eq("id", messageId)
        .single();

      if (error) throw error;

      const { data: updated, error: updateError } = await supabase
        .from("messages")
        .update({ dislikes: (data.dislikes || 0) + 1 })
        .eq("id", messageId)
        .select()
        .single();

      if (updateError) throw updateError;

      io.emit("dislikes_updated", updated);
    } catch (err) {
      console.error("Dislikes error:", err.message);
    }
  });

  // ---------------- DELETE MESSAGE ----------------
  
  socket.on("delete", async (messageId) => {
    try {
      console.log("Deleting:", messageId);

      const { data, error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        console.log("Nothing deleted (ID not found)");
        return;
      }

      io.emit("message_deleted", messageId);
    } catch (err) {
      console.error("Delete error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});



const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});