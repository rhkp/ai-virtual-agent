import { useState, useCallback, useEffect } from 'react';
import { LlamaStackParser, extractSessionId } from '../adapters/llamaStackAdapter';
import { CHAT_API_ENDPOINT } from '../config/api';
import { fetchChatSession } from '@/services/chat-sessions';

// Helper function to process stored chat messages that might contain raw JSON
const processStoredMessage = (content: string, agentType: 'Regular' | 'ReAct' = 'Regular', tools: string[] = []): { content: string; thoughts?: string } => {
  // Only process JSON for ReAct agents
  if (agentType === 'ReAct') {
    // Check if this is already processed (contains thinking emoji)
    if (content.includes('🤔 **Thinking:**')) {
      return { content }; // Already formatted, return as-is
    }
    
    // Check if this is a raw ReAct JSON response
    try {
      const jsonData = JSON.parse(content);
      if (jsonData.thought && jsonData.answer) {
        // This is a ReAct response, format it exactly like our adapter does
        const thoughts = jsonData.thought;
        let cleanAnswer = jsonData.answer;
        
        // Apply the same cleaning logic as our adapter
        if (cleanAnswer.startsWith('Final Answer: ')) {
          cleanAnswer = cleanAnswer.replace('Final Answer: ', '');
        }
        
        // Format like the adapter does for consistency
        const formattedContent = `🤔 **Thinking:** ${thoughts}\n\n${cleanAnswer}`;
        
        return { content: formattedContent };
      }
    } catch (e) {
      // Not JSON, return as-is
    }
  }
  
  return { content };
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thoughts?: string; // Simple string for thoughts (not array)
}

export interface UseLlamaChatOptions {
  onError?: (error: Error) => void;
  onFinish?: (message: ChatMessage) => void;
}

/**
 * Simple chat hook that directly handles LlamaStack without the AI SDK overhead
 */
export function useChat(agentId: string, agentType: 'Regular' | 'ReAct' = 'Regular', options?: UseLlamaChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, value?: string | number) => {
      const newValue = value !== undefined ? String(value) : event.target.value;
      setInput(newValue);
    },
    []
  );
  interface SessionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }
  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        setIsLoading(true);
        console.log(`Loading session ${sessionId} for agent ${agentId}`);
        const sessionDetail = await fetchChatSession(sessionId, agentId);
        if (!sessionDetail) {
          throw new Error(`Session ${sessionId} not found for agent ${agentId}`);
        }
        console.log('Session detail:', sessionDetail);
        // Set the session ID
        setSessionId(sessionId);

        // Convert messages to our format with processing for stored ReAct responses
        const convertedMessages: ChatMessage[] = sessionDetail.messages.map(
          (msg: SessionMessage, index: number) => {
            let processedContent = msg.content;
            
            // Process assistant messages that might contain raw JSON
            if (msg.role === 'assistant') {
              const processed = processStoredMessage(msg.content, agentType, []);
              processedContent = processed.content;
            }
            
            return {
              id: `${msg.role}-${sessionId}-${index}`,
              role: msg.role,
              content: processedContent,
              timestamp: new Date(),
            };
          }
        );

        setMessages(convertedMessages);
        console.log('Loaded messages:', convertedMessages);
        // Update agent if different
        if (sessionDetail.agent_id && sessionDetail.agent_id !== agentId) {
          console.warn(`Loaded session for different agent: ${sessionDetail.agent_id}`);
          // Optionally handle this case, e.g., notify user or reset state
        }
      } catch (error) {
        console.error('Error loading session:', error);
        options?.onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [agentId, options, agentType]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      // Add user message immediately
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        // Prepare request
        const requestBody = {
          virtualAssistantId: agentId,
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: true,
          ...(sessionId ? { sessionId } : {}),
        };

        const response = await fetch(CHAT_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Process stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                // Stream finished
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    options?.onFinish?.(lastMsg);
                  }
                  return updated;
                });
                continue;
              }

              // Check for session ID
              const newSessionId = extractSessionId(data);
              if (newSessionId) {
                setSessionId(newSessionId);
                continue;
              }

              // Parse content using proper agentType
              const parsed = LlamaStackParser.parse(data, agentType);
              if (parsed) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    // Prevent duplication: only append if this content doesn't already exist
                    const trimmedParsed = parsed.trim();
                    if (!lastMsg.content.includes(trimmedParsed) && trimmedParsed.length > 0) {
                      lastMsg.content += parsed;
                    }
                  }
                  return updated;
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        options?.onError?.(new Error(errorMessage));

        // Remove the loading assistant message on error
        setMessages((prev) => prev.filter((msg) => msg.role !== 'assistant' || msg.content !== ''));
      } finally {
        setIsLoading(false);
      }
    },
    [agentId, messages, sessionId, isLoading, options, agentType]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (input.trim()) {
        void sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  const append = useCallback(
    (message: { role: 'user' | 'assistant'; content: string }) => {
      void sendMessage(message.content);
    },
    [sendMessage]
  );

  // Reset state when agentId changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setSessionId(null);
  }, [agentId]);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    loadSession,
    sessionId,
  };
}
