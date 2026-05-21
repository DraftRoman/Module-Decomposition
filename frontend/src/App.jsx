import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://back-with-database.178.105.39.91.sslip.io", {
  transports: ["websocket"]
});

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const divRef = useRef(null);

  useEffect(() => {
    socket.on("initial_messages", (data) => {
      setMessages(data);
    });

    const handleReceiveMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("receive_message", handleReceiveMessage);
    
    socket.on("likes_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updatedMessage.id
            ? updatedMessage
            : m
        )
      );
    });

    return () => {
      socket.off("initial_messages");
      socket.off("receive_message", handleReceiveMessage);
      socket.off("likes_updated");
    };
  }, []);

  useEffect(() => {
    divRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    socket.emit("send_message", inputValue);
    setInputValue("");
  };
  const handleLikes = (id) => {
    socket.emit("add_likes", id);
  };
  

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

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="chat-app">
      <h1>Real Chat Application</h1>

      <div className="chat-area">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="message"
          >
            <p>{msg.message}</p>

            <button
              className="like-button"
              onClick={() =>
                handleLikes(msg.id)
              }
            >
              ❤️ {msg.likes}
            </button>
          </div>
        ))}
        <div ref={divRef} />
      </div>
      <input
        className="chat-input"
        placeholder="Type a message..."
        value={inputValue}
        onChange={(e) =>
          setInputValue(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }
        }}
      />

      <button
        className="submit button"
        onClick={handleSubmit}
      >
        Send
      </button>

      <button
        className="clear button"
        onClick={handleClear}
      >
        Clear (local only)
      </button>
    </div>
  );
}

export default App;