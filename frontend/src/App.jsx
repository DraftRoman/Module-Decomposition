import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    socket.on("initial_messages", (data) => {
      setMessages(data);
    });

    const handleReceiveMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("initial_messages");
      socket.off("receive_message", handleReceiveMessage);
    };
  }, []);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    socket.emit("send_message", inputValue);
    setInputValue("");
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="chat-app">
      <h1>Real Chat Application</h1>

      <input
        className="chat-input"
        placeholder="Type a message..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />

      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <p>{msg.message}</p>
            <button className="like-button" onClick={() => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msg.id ? { ...m, likes: m.likes + 1 } : m)
              );

              console.log(`Liked message with id: ${msg.id}`);
              console.log(`Current messages state:`, messages);

            }}>
              ❤️ {msg.likes}
            </button>
          </div>
        ))}
      </div>

      <button className="submit button" onClick={handleSubmit}>
        Send
      </button>

      <button className="clear button" onClick={handleClear}>
        Clear (local only)
      </button>
    </div>
  );
}

export default App;