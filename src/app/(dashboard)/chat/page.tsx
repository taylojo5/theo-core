"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import {
  ChatInput,
  ConversationSidebar,
  MessageList,
  type Conversation,
  type Message,
} from "@/components/chat";
import { generateId } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Chat Page
// ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("id");

  // State
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] =
    React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<string>();

  // Fetch conversations on mount
  React.useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when conversation changes
  React.useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  // ─────────────────────────────────────────────────────────────
  // API Functions
  // ─────────────────────────────────────────────────────────────

  async function fetchConversations() {
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function fetchMessages(convId: string) {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function createConversation(): Promise<string | null> {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        // Add to top of list
        setConversations((prev) => [data, ...prev]);
        return data.id;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
    return null;
  }

  async function deleteConversation(id: string) {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) {
          router.push("/chat");
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Send Message
  // ─────────────────────────────────────────────────────────────

  async function handleSend(content: string) {
    let activeConversationId = conversationId;

    // Create conversation if needed
    if (!activeConversationId) {
      const newId = await createConversation();
      if (!newId) return;
      activeConversationId = newId;
      router.push(`/chat?id=${newId}`);
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add placeholder for assistant response
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);
    setIsProcessing(true);

    try {
      // Send message to API
      const res = await fetch(
        `/api/chat/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      if (res.ok) {
        const data = await res.json();

        // Update messages with actual response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  id: data.assistantMessage?.id || m.id,
                  content:
                    data.assistantMessage?.content ||
                    "I received your message!",
                }
              : m.id === userMessage.id
                ? { ...m, id: data.userMessage?.id || m.id }
                : m
          )
        );

        // Update conversation title if this was the first message
        if (data.conversation?.title) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    title: data.conversation.title,
                    updatedAt: new Date(),
                  }
                : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Update with error message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: "Sorry, I encountered an error. Please try again.",
              }
            : m
        )
      );
    } finally {
      setStreamingMessageId(undefined);
      setIsProcessing(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────

  function handleSelectConversation(id: string) {
    router.push(`/chat?id=${id}`);
  }

  async function handleNewConversation() {
    router.push("/chat");
    setMessages([]);
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <DashboardLayout
      sidebar={
        <ConversationSidebar
          conversations={conversations}
          activeId={conversationId || undefined}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDelete={deleteConversation}
          isLoading={isLoadingConversations}
        />
      }
    >
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <MessageList
          messages={messages}
          user={session?.user}
          streamingMessageId={streamingMessageId}
          isLoading={isLoadingMessages}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          isProcessing={isProcessing}
          disabled={isLoadingMessages}
        />
      </div>
    </DashboardLayout>
  );
}
