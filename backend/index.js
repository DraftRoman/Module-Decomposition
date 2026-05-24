require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const allowedOrigin = process.env.CLIENT_URL || "*";


const allowedOrigins = [
  allowedOrigin,
  "http://front-with-database.178.105.39.91.sslip.io",
  "https://front-with-database.178.105.39.91.sslip.io"
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get("/", async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ messages: messages || [] });
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    res.status(500).json({ error: "Unable to fetch messages" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  try {
    const { data: dbMessages, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    socket.emit("initial_messages", dbMessages || []);
  } catch (err) {
    console.error("Error fetching initial messages:", err.message);
  }


  socket.on("send_message", async (messageData) => {
    try {
      const { message, user_id, author } = messageData;
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            message,
            user_id,
            author
          }
        ])
        .select()
        .single();
      if (error) throw error;
      io.emit("receive_message", data);
    } catch (err) {
      console.error("Error saving message:", err.message);
    }
  });


  socket.on("add_likes", async (messageId) => {
    try {
      const { data: currentMsg, error: fetchError } = await supabase
        .from("messages")
        .select("likes")
        .eq("id", messageId)
        .single();
      
      if (fetchError) throw fetchError;

      if (currentMsg) {
        const currentLikesCount = currentMsg.likes || 0;
        const { data: updatedMessage, error: updateError } = await supabase
          .from("messages")
          .update({ likes: currentLikesCount + 1 })
          .eq("id", messageId)
          .select()
          .single();

        if (updateError) throw updateError;
        io.emit("likes_updated", updatedMessage);
      }
    } catch (err) {
      console.error("Error updating likes:", err.message);
    }
  });

  socket.on("add_dislikes", async (messageId) => {
    try {
      const { data: currentMsg, error: fetchError } = await supabase
        .from("messages")
        .select("dislikes")
        .eq("id", messageId)
        .single();
      
      if (fetchError) throw fetchError;

      if (currentMsg) {
        const currentDislikesCount = currentMsg.dislikes || 0;
        const { data: updatedMessage, error: updateError } = await supabase
          .from("messages")
          .update({ dislikes: currentDislikesCount + 1 })
          .eq("id", messageId)
          .select()
          .single();

        if (updateError) throw updateError;
        io.emit("dislikes_updated", updatedMessage);
      }
    } catch (err) {
      console.error("Error updating dislikes:", err.message);
    }
  });

  socket.on("delete", async (messageId) => {
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);
      if (error) throw error;
      io.emit("message_deleted", messageId);
    } catch (err) {
      console.error("Error deleting message:", err.message);
    }
  });




  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});