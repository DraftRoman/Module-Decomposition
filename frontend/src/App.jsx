import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { supabase } from "./supabaseClient";
import "./App.css";

const socket = io("http://back-with-database.178.105.39.91.sslip.io", {
  transports: ["polling", "websocket"] 
});

const adminId = "99f421f5-0f62-46e3-8a96-fc95d823a4e8";

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

  // Monitor Authentication State Changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Socket Events Listeners
  useEffect(() => {
    socket.on("initial_messages", setMessages);

    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });
    
    socket.on("likes_updated", (updated) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    });

    socket.on("dislikes_updated", (updated) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    });

    socket.on("message_deleted", (id) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });

    return () => {
      socket.off("initial_messages");
      socket.off("receive_message");
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

  // Auth Actions
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

  // Chat Actions
  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    socket.emit("send_message", {
      message: inputValue,
      user_id: session.user.id,
      author: session.user.user_metadata.username || session.user.email
    });

    setInputValue("");
  };

  const handleDelete = (id) => socket.emit("delete", id);
  const handleLikes = (id) => socket.emit("add_likes", id);
  const handleDislikes = (id) => socket.emit("add_dislikes", id);

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

  const displayName = session.user.user_metadata.username || session.user.email;

  // --- LOGGED IN: SHOW CHAT AREA ---
  return (
    <div className="chat-app">
      <div className="chat-header">
        <span>
          Hello <strong>{displayName}</strong>
        </span>
        <button className="logout-button" onClick={handleLogout}>Log Out</button>
      </div>

      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <div>
              <p>{msg.message}</p>
              <p className="author">{msg.author}</p>
            </div>
            <div className="reaction-group">
              <button onClick={() => handleLikes(msg.id)}>
                ❤️ {msg.likes || 0}
              </button>

              <button onClick={() => handleDislikes(msg.id)}>
                👎 {msg.dislikes || 0}
              </button>

              {(msg.user_id === session.user.id ||
                session.user.id === adminId) && (
                <button onClick={() => handleDelete(msg.id)}>
                  🪣
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={divRef} />
      </div>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />

      <button onClick={handleSubmit}>Send</button>
    </div>
  );
}

export default App;