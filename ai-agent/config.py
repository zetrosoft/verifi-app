import os
from dotenv import load_dotenv

load_dotenv()

FUJI_RPC_URL = os.getenv("FUJI_RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
AI_AGENT_PRIVATE_KEY = os.getenv("AI_AGENT_PRIVATE_KEY")
IPFS_API_URL = os.getenv("IPFS_API_URL")
CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH")
MINIMUM_COVERAGE_PERCENTAGE = int(os.getenv("MINIMUM_COVERAGE_PERCENTAGE", "90"))
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Basic validation (can be expanded)
if not FUJI_RPC_URL:
    raise ValueError("FUJI_RPC_URL not set in .env")
if not CONTRACT_ADDRESS:
    raise ValueError("CONTRACT_ADDRESS not set in .env")
if not AI_AGENT_PRIVATE_KEY:
    raise ValueError("AI_AGENT_PRIVATE_KEY not set in .env")
if not IPFS_API_URL:
    raise ValueError("IPFS_API_URL not set in .env")
if not CONTRACT_ABI_PATH:
    raise ValueError("CONTRACT_ABI_PATH not set in .env")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not set in .env")
