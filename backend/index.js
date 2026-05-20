require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase Client (Use your service_role key here if bypassing RLS, or anon key)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
const allowedOrigin = process.env.CLIENT_URL || "*";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] }
});

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  // 1. Fetch initial messages from real Supabase Database
  const { data: initialMessages, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (!error) {
    socket.emit("initial_messages", initialMessages);
  }

  // 2. Handle sending a message
  socket.on("send_message", async (data) => {
    // Expecting an object from frontend containing conversation_id, sender_id, text
    const newMessage = {
      conversation_id: data.conversation_id, 
      sender_id: data.sender_id,             
      text: data.text,
      status: "sent", // Fixed: wrapped in quotes
      likes: 0,
      attachments: []
    };

    // Save to Postgres
    const { data: savedMessage, error: insertError } = await supabase
      .from("messages")
      .insert([newMessage])
      .select()
      .single();

    if (!insertError && savedMessage) {
      io.emit("receive_message", savedMessage);
    }
  });

  // 3. Handle updates to likes
  socket.on("add_likes", async (data) => {
    // Increment directly in the database row safely
    const { data: updatedMessage, error: updateError } = await supabase
      .from("messages")
      .update({ likes: data.currentLikes + 1 })
      .eq("id", data.id)
      .select()
      .single();

    if (!updateError && updatedMessage) {
      io.emit("likes_updated", updatedMessage);
    }
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));