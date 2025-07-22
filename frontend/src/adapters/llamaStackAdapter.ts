// Define our custom parser type
type LlamaStackParser = {
  parse(text: string, agentType?: 'Regular' | 'ReAct'): string | null;
};

interface LlamaStackResponse {
  type: string;
  content: string;
  sessionId?: string;
  tool?: {
    name: string;
    params?: Record<string, unknown>;
  };
}

/**
 * LlamaStackParser - Transforms the Llama Stack API response format into
 * displayable content for the chat interface.
 *
 * Handles different response types (text, tool, reasoning, error) and properly
 * processes the session ID from the stream.
 */
export const LlamaStackParser: LlamaStackParser = {
  parse(line: string, agentType: 'Regular' | 'ReAct' = 'Regular'): string | null {
    // Skip [DONE] events (empty lines)
    if (!line || line === '[DONE]') {
      return null;
    }

    // Try to parse the response
    try {
      const json = JSON.parse(line) as LlamaStackResponse;

      // Store session ID if present (to be handled by the adapter)
      if (json.type === 'session' && json.sessionId) {
        // This will be handled separately by the adapter
        return null;
      }

      // Handle text content - apply formatting based on actual agent type
      if (json.type === 'text' && json.content) {
        let content = json.content;
        
        if (agentType === 'ReAct') {
          // Apply ReAct-specific cleaning
          if (content.startsWith('Final Answer: ')) {
            content = content.replace('Final Answer: ', '');
          }
          content = content.replace(/\[Tool:[^\]]+\]\s*Using\s+"[^"]+"\s*tool\s*/g, '');
          
          // Handle duplicated content (common in ReAct responses)
          // Direct approach: check if text is duplicated exactly
          if (content.length > 50) {
            const half = Math.floor(content.length / 2);
            const firstHalf = content.substring(0, half);
            const secondHalf = content.substring(half);
            
            // Check for exact duplication
            if (firstHalf === secondHalf) {
              content = firstHalf;
            } else {
              // Check for near-exact duplication (with small differences in spacing/punctuation)
              const cleanFirst = firstHalf.replace(/\s+/g, ' ').trim();
              const cleanSecond = secondHalf.replace(/\s+/g, ' ').trim();
              if (cleanFirst === cleanSecond) {
                content = firstHalf;
              }
            }
          }
        }
        // For Regular agents, return content as-is (no processing)
        
        return content;
      }

      // Handle tool use
      if (json.type === 'tool' && json.content) {
        // For ReAct agents: Hide ALL tool messages (they're all internal)
        if (agentType === 'ReAct') {
          return null; // Hide all ReAct tool execution details
        }
        // For Regular agents: Show tool usage (if any)
        const toolName = json.tool?.name || 'unknown';
        return `🛠 **Using ${toolName}:** ${json.content}\n\n`;
      }

      // Handle reasoning - only for ReAct agents
      if (json.type === 'reasoning' && json.content && agentType === 'ReAct') {
        return `🤔 **Thinking:** ${json.content}\n\n`;
      }

      // Handle errors
      if (json.type === 'error') {
        console.error('LlamaStack API error:', json.content);
        return `[Error: ${json.content}]`;
      }

      return null;
    } catch (e) {
      // If we can't parse as JSON, return the raw line
      console.warn('Failed to parse LlamaStack response:', e);
      return null;
    }
  },
};

/**
 * Extracts session ID from the Llama Stack API response
 * This is used by the adapter to maintain conversation context
 */
export const extractSessionId = (line: string): string | null => {
  try {
    const json = JSON.parse(line) as LlamaStackResponse;
    if (json.type === 'session' && json.sessionId) {
      return json.sessionId;
    }
  } catch {
    // Ignore parse errors for non-session messages
  }
  return null;
};
