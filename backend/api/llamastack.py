import os

from dotenv import load_dotenv
from llama_stack_client import LlamaStackClient

from ..virtual_agents.agent_resource import EnhancedAgentResource

load_dotenv()

LLAMASTACK_URL = os.getenv("LLAMASTACK_URL", "http://localhost:8321")

client = LlamaStackClient(
    base_url=LLAMASTACK_URL,
    provider_data={
        "tavily_search_api_key": os.environ.get("TAVILY_SEARCH_API_KEY", ""),
        "fireworks_api_key": os.environ.get("FIREWORKS_API_KEY", ""),
        "together_api_key": os.environ.get("TOGETHER_API_KEY", ""),
        "openai_api_key": os.environ.get("OPENAI_API_KEY", ""),
    },
)

client.agents = EnhancedAgentResource(client)
