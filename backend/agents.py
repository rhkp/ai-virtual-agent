import json
import requests
from typing import Any, Callable, List, Optional, Tuple, Union

from llama_stack_client.lib.agents.agent import AgentConfig
from llama_stack_client.lib.agents.client_tool import ClientTool
from llama_stack_client.lib.agents.tool_parser import ToolParser
from llama_stack_client.types import SamplingParams, UserMessage
from llama_stack_client.types.agents.turn_create_params import Toolgroup
from llama_stack_client.types.shared_params.agent_config import ToolConfig


class SafeAgent:
    """A safe agent wrapper that uses direct HTTP calls to LlamaStack."""

    def __init__(
        self,
        client,
        agent_id: str,
        model: Optional[str] = None,
        instructions: Optional[str] = None,
        tools: Optional[List[Union[Toolgroup, ClientTool, Callable[..., Any]]]] = None,
        tool_config: Optional[ToolConfig] = None,
        sampling_params: Optional[SamplingParams] = None,
        max_infer_iters: Optional[int] = None,
        agent_config: Optional[AgentConfig] = None,
        client_tools: Tuple[ClientTool, ...] = (),
        tool_parser: Optional[ToolParser] = None,
    ):
        # Call parent's __init__ but skip the initialize() call
        self.client = client
        self.model = model
        self.instructions = instructions
        self.tools = tools or []
        self.tool_config = tool_config
        self.sampling_params = sampling_params
        self.max_infer_iters = max_infer_iters
        self.agent_config = agent_config
        self.client_tools = client_tools
        self.tool_parser = tool_parser
        self.sessions = []
        self.builtin_tools = {}

        # Set the agent_id directly instead of calling initialize()
        self.agent_id = agent_id
        
    def create_turn(self, session_id: str, messages: List[UserMessage], stream: bool = False):
        """Create a turn using direct HTTP calls to avoid Python client issues."""
        # Convert UserMessage objects to dict format
        messages_dict = []
        for msg in messages:
            if hasattr(msg, 'model_dump'):
                messages_dict.append(msg.model_dump())
            elif hasattr(msg, 'dict'):
                messages_dict.append(msg.dict())
            else:
                # Fallback for simple objects
                messages_dict.append({
                    'role': msg.role,
                    'content': msg.content
                })
        
        # Make direct HTTP request to LlamaStack
        payload = {
            'agent_id': self.agent_id,
            'session_id': session_id,
            'messages': messages_dict,
            'stream': stream
        }
        
        # Use the client's base URL for the request
        base_url = getattr(self.client, 'base_url', 'http://localhost:8321')
        url = f"{base_url}/v1/agents/turns"
        
        response = requests.post(url, json=payload, stream=stream)
        
        if stream:
            return response.iter_lines()
        else:
            return response.json()


class SafeReActAgent(SafeAgent):
    """A safe ReAct agent wrapper that uses direct HTTP calls."""

    def __init__(
        self,
        client,
        agent_id: str,
        model: Optional[str] = None,
        tools: Optional[List[Union[Toolgroup, ClientTool, Callable[..., Any]]]] = None,
        tool_config: Optional[ToolConfig] = None,
        sampling_params: Optional[SamplingParams] = None,
        max_infer_iters: Optional[int] = None,
        response_format: Optional[dict] = None,
        agent_config: Optional[AgentConfig] = None,
        client_tools: Tuple[ClientTool, ...] = (),
        tool_parser: Optional[ToolParser] = None,
    ):
        # Call parent init
        super().__init__(
            client=client,
            agent_id=agent_id,
            model=model,
            tools=tools,
            tool_config=tool_config,
            sampling_params=sampling_params,
            max_infer_iters=max_infer_iters,
            agent_config=agent_config,
            client_tools=client_tools,
            tool_parser=tool_parser,
        )
        self.response_format = response_format


# For backward compatibility
ExistingAgent = SafeAgent
ExistingReActAgent = SafeReActAgent
