import { AgentList } from '@/components/agent-list';
import { NewAgentCard } from '@/components/new-agent-card';
import { ToolAssociationInfo } from '@/types';
import { Flex, FlexItem, PageSection, Title } from '@patternfly/react-core';
import { createFileRoute } from '@tanstack/react-router';

// Add agent type enum
export type AgentType = 'Regular' | 'ReAct';

// Type def for fetching agents
export interface Agent {
  id: string;
  name: string;
  agent_type?: AgentType;  // Add this line (optional for now since backend doesn't have it yet)
  model_name: string;
  prompt: string;
  tools: ToolAssociationInfo[];
  knowledge_base_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  // Add other relevant agent properties here
}

// Type def for creating agents
export interface NewAgent {
  name: string;
  agent_type?: AgentType;
  model_name: string;
  prompt: string;
  tools: ToolAssociationInfo[];
  knowledge_base_ids: string[];
}

export const Route = createFileRoute('/config/agents')({
  component: Agents,
});

// --- 5. Main AgentsPage Component ---
export function Agents() {
  return (
    <PageSection>
      <Flex direction={{ default: 'column' }} gap={{ default: 'gapMd' }}>
        <FlexItem>
          <Title headingLevel="h1">Agents</Title>
        </FlexItem>
        <FlexItem>
          <NewAgentCard />
        </FlexItem>
        <FlexItem>
          <AgentList />
        </FlexItem>
      </Flex>
    </PageSection>
  );
}
