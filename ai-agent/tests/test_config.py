import pytest
import os
from unittest.mock import patch
from ai_agent import config

def test_config_loads_env_variables():
    # Patch os.getenv to simulate environment variables
    with patch.dict(os.environ, {
        "FUJI_RPC_URL": "http://mock-fuji-rpc",
        "CONTRACT_ADDRESS": "0xMockContractAddress",
        "AI_AGENT_PRIVATE_KEY": "0xMockPrivateKey",
        "IPFS_API_URL": "http://mock-ipfs-api",
        "CONTRACT_ABI_PATH": "/mock/abi/path.json",
        "MINIMUM_COVERAGE_PERCENTAGE": "85"
    }):
        # Reload config module to pick up patched env vars
        import importlib
        importlib.reload(config)

        assert config.FUJI_RPC_URL == "http://mock-fuji-rpc"
        assert config.CONTRACT_ADDRESS == "0xMockContractAddress"
        assert config.AI_AGENT_PRIVATE_KEY == "0xMockPrivateKey"
        assert config.IPFS_API_URL == "http://mock-ipfs-api"
        assert config.CONTRACT_ABI_PATH == "/mock/abi/path.json"
        assert config.MINIMUM_COVERAGE_PERCENTAGE == 85

def test_config_raises_error_if_required_env_missing():
    # Clear a required env variable
    with patch.dict(os.environ, {
        "FUJI_RPC_URL": "http://mock-fuji-rpc",
        "CONTRACT_ADDRESS": "", # Missing value
        "AI_AGENT_PRIVATE_KEY": "0xMockPrivateKey",
        "IPFS_API_URL": "http://mock-ipfs-api",
        "CONTRACT_ABI_PATH": "/mock/abi/path.json",
        "MINIMUM_COVERAGE_PERCENTAGE": "90"
    }):
        with pytest.raises(ValueError, match="CONTRACT_ADDRESS not set in .env"):
            import importlib
            importlib.reload(config)

def test_minimum_coverage_percentage_default():
    # Ensure default is loaded if not specified
    with patch.dict(os.environ, {
        "FUJI_RPC_URL": "http://mock-fuji-rpc",
        "CONTRACT_ADDRESS": "0xMockContractAddress",
        "AI_AGENT_PRIVATE_KEY": "0xMockPrivateKey",
        "IPFS_API_URL": "http://mock-ipfs-api",
        "CONTRACT_ABI_PATH": "/mock/abi/path.json",
        "MINIMUM_COVERAGE_PERCENTAGE": "" # Empty value
    }):
        import importlib
        importlib.reload(config)
        assert config.MINIMUM_COVERAGE_PERCENTAGE == 90 # Default value
