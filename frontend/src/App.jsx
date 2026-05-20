import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import "./App.css";

// Initialize Supabase Client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const divRef = useRef(null);

  const activeConversationId = "ef9ea1e8-d3f0-4c59-9942-41f1fab3f50e"; 

  useEffect(() => {
    // 1. Get initial session status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for auth changes (SIGN_IN, SIGN_OUT, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // 3. Connect real-time socket replica engine
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        }
      )
      .subscribe();

    fetchMessages();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    divRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error) setMessages(data);
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || !session?.user) return;

    const { error } = await supabase.from("messages").insert([
      {
        text: inputValue,
        conversation_id: activeConversationId,
        sender_id: session.user.id, // Securely targets the authenticated individual
        status: "sent"
      }
    ]);

    if (!error) setInputValue("");
  };

  const handleLikes = async (msg) => {
    await supabase
      .from("messages")
      .update({ likes: msg.likes + 1 })
      .eq("id", msg.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // IF NOT LOGGED IN: Show the beautiful Supabase pre-built Auth Form
  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Welcome to Messenger</h2>
          <p>Please sign in or create an account to start chatting.</p>
          
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#2563eb",       // Customizes the main action button colors
                    brandAccent: "#1d4ed8",
                  },
                },
              },
            }}
            // Add any provider you have enabled inside your Supabase backend dashboard
            providers={["github", "google"]} 
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    );
  }

  // IF LOGGED IN: Show the messenger app
  return (
    <div className="chat-app">
      <header className="chat-header">
        <h1>Real Chat Application</h1>
        <div className="user-info">
          <span>{session.user.email}</span>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="chat-area">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`message-bubble ${msg.sender_id === session.user.id ? "own-message" : "other-message"}`}
          >
            <p>{msg.text}</p>
            <button className="like-button" onClick={() => handleLikes(msg)}>
              ❤️ {msg.likes}
            </button>
          </div>
        ))}
        <div ref={divRef} />
      </div>

      <div className="input-area">
        <input
          className="chat-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button className="submit-button" onClick={handleSubmit}>Send</button>
      </div>
    </div>
  );
}

export default App;