import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, api } from "./api";

const websocketUrl = () => {
  const baseUrl = API_URL || window.location.origin;
  return `${baseUrl.replace(/^http/, "ws")}/ws`;
};

export function SupportMessaging({ user, notify }) {
  const stompClientRef = useRef(null);
  const selectedIdRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [connected, setConnected] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const response = await api(
        "/api/support/conversations?size=50&sort=createdAt,desc",
      );
      setConversations(response.content || []);
    } catch (error) {
      notify(error.message, "error");
    }
  }, [notify]);

  const openConversation = async (conversation) => {
    selectedIdRef.current = conversation.id;
    setSelected(conversation);
    try {
      const response = await api(
        `/api/support/conversations/${conversation.id}/messages?size=100&sort=sentAt,asc`,
      );
      setMessages(response.content || []);
    } catch (error) {
      notify(error.message, "error");
    }
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const client = new Client({
      brokerURL: websocketUrl(),
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true);
        client.subscribe("/user/queue/support", (frame) => {
          const incomingMessage = JSON.parse(frame.body);
          setMessages((current) =>
            selectedIdRef.current === incomingMessage.conversationId
              ? [...current, incomingMessage]
              : current,
          );
          loadConversations();
        });
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });
    stompClientRef.current = client;
    client.activate();
    return () => client.deactivate();
  }, [loadConversations]);

  const createConversation = async (event) => {
    event.preventDefault();
    try {
      const conversation = await api("/api/support/conversations", {
        method: "POST",
        body: JSON.stringify({ subject }),
      });
      setSubject("");
      await loadConversations();
      await openConversation(conversation);
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const assignConversation = async () => {
    try {
      const conversation = await api(
        `/api/support/conversations/${selected.id}/assign`,
        { method: "PUT" },
      );
      setSelected(conversation);
      await loadConversations();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const closeConversation = async () => {
    try {
      const conversation = await api(
        `/api/support/conversations/${selected.id}/close`,
        { method: "PUT" },
      );
      setSelected(conversation);
      await loadConversations();
      notify("Görüşme kapatıldı.");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!content.trim() || !selected || !connected) return;
    stompClientRef.current.publish({
      destination: "/app/support.send",
      body: JSON.stringify({
        conversationId: selected.id,
        content: content.trim(),
      }),
    });
    setContent("");
  };

  const canSend =
    selected &&
    selected.status !== "CLOSED" &&
    (user.role === "USER" || selected.agentUsername === user.username);

  return (
    <section className="support-layout">
      <aside className="support-sidebar">
        <div className="support-title">
          <div>
            <h2>Canlı destek</h2>
            <small>{connected ? "Bağlı" : "Bağlantı kuruluyor…"}</small>
          </div>
        </div>
        {user.role === "USER" && (
          <form className="support-create" onSubmit={createConversation}>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Görüşme konusu"
              maxLength="120"
              required
            />
            <button className="primary">Görüşme aç</button>
          </form>
        )}
        <div className="support-conversations">
          {conversations.map((conversation) => (
            <button
              className={selected?.id === conversation.id ? "active" : ""}
              key={conversation.id}
              onClick={() => openConversation(conversation)}
            >
              <b>{conversation.subject}</b>
              <small>
                #{conversation.id} · {conversation.status}
                {user.role === "ADMIN"
                  ? ` · ${conversation.clientUsername}`
                  : ""}
              </small>
            </button>
          ))}
        </div>
      </aside>
      <div className="support-chat">
        {!selected ? (
          <div className="empty-state">Bir görüşme seçin.</div>
        ) : (
          <>
            <header>
              <div>
                <h3>{selected.subject}</h3>
                <small>{selected.agentUsername || "Temsilci bekleniyor"}</small>
              </div>
              {user.role === "ADMIN" &&
                !selected.agentId &&
                selected.status !== "CLOSED" && (
                  <button className="primary" onClick={assignConversation}>
                    Görüşmeyi üstlen
                  </button>
                )}
              {user.role === "ADMIN" &&
                selected.status === "OPEN" &&
                selected.agentUsername === user.username && (
                  <button className="danger" onClick={closeConversation}>
                    Görüşmeyi kapat
                  </button>
                )}
            </header>
            <div className="support-messages">
              {messages.map((message) => (
                <div
                  className={`support-message ${message.senderUsername === user.username ? "mine" : ""}`}
                  key={message.id}
                >
                  <b>{message.senderUsername}</b>
                  <p>{message.content}</p>
                  <small>
                    {new Date(message.sentAt).toLocaleString("tr-TR")}
                  </small>
                </div>
              ))}
            </div>
            {canSend ? (
              <form className="support-send" onSubmit={sendMessage}>
                <input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Mesajınızı yazın"
                  maxLength="1000"
                  required
                />
                <button className="primary" disabled={!connected}>
                  Gönder
                </button>
              </form>
            ) : (
              <p className="support-waiting">
                {selected.status === "CLOSED"
                  ? "Bu görüşme kapatıldı."
                  : "Mesaj göndermek için görüşmeyi üstlenin."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
