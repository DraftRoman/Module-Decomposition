import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { supabase } from "./supabaseClient";
import "./App.css";

const socket = io("http://back-with-database.178.105.39.91.sslip.io", {
  transports: ["websocket"]
});

function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  
  // Auth state inputs
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  
  const divRef = useRef(null);

  // 1. Monitor Authentication State Changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    socket.on("initial_messages", (data) => setMessages(data));

    const handleReceiveMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("receive_message", handleReceiveMessage);
    
    socket.on("likes_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updatedMessage.id ? updatedMessage : m
        )
      );
    });
    socket.on("dislikes_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updatedMessage.id ? updatedMessage : m
        )
      );
    });
    socket.on("message_deleted", (messageId) => {
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== messageId)
      );
    });


    return () => {
      socket.off("initial_messages");
      socket.off("receive_message", handleReceiveMessage);
      socket.off("likes_updated");
      socket.off("dislikes_updated");
      socket.off("message_deleted");
    };
  }, []);

  useEffect(() => {
    divRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  // 2. Auth Actions
  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    if (error) alert(error.message);
    else alert("Signup successful! You can now log in.");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    const messageData = {
      message: inputValue,
      user_id: session.user.id,
      author: session.user.user_metadata.username || session.user.email
    };
    socket.emit("send_message", messageData);
    setInputValue("");
  };

  const handleLikes = (id) =>socket.emit("add_likes", id);
  const handleDislikes = (id) =>socket.emit("add_dislikes", id);
  const handleDelete = (id) => socket.emit("delete", id)
  const handleClear = () => setMessages([]);

  // --- RENDERING ROUTER ---
  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>{isRegistering ? "Create Account" : "Welcome Back"}</h2>
          <p>{isRegistering ? "Sign up to join the chat room" : "Sign in to access your messages"}</p>
          
          <form onSubmit={isRegistering ? handleSignUp : handleLogin}>
            {isRegistering && (
              <input
                className="chat-input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            )}
            <input
              className="chat-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="chat-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="button submit" style={{ width: '100%', margin: '10px 0' }}>
              {isRegistering ? "Sign Up" : "Log In"}
            </button>
          </form>

          <button 
            className="clear button" 
            style={{ width: '100%', background: 'transparent', color: '#555' }}
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  // --- LOGGED IN: SHOW CHAT AREA ---
  return (
    <div className="chat-app">
      <div className="chat-header">
        <span>Logged in as: <strong>{session.user.email}</strong></span>
        <button className="logout-button" onClick={handleLogout}>Log Out</button>
      </div>

      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <p className="author">Posted by: {msg.author}</p>
            <p className="author">{msg.user_id}</p>
            <div className="reaction-group">
              <button className="like-button" onClick={() => handleLikes(msg.id)}>
                ❤️ {msg.likes || 0}
              </button>
              <button className="dislike-button" onClick={() => handleDislikes(msg.id)}>
                👎 {msg.dislikes || 0}
              </button>
              {msg.user_id === session.user.id &&
                (
                <button className="dislike-button"
                  onClick={() => handleDelete(msg.id)}>
                  🪣
                  </button>
                )}
            </div>
          </div>
        ))}
        <div ref={divRef} />
      </div>
      <input
        className="chat-input"
        placeholder="Type a message..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />

      <button className="submit button" onClick={handleSubmit}>Send</button>
      <button className="clear button" onClick={handleClear}>Clear (local)</button>
    </div>
  );
}

export default App;