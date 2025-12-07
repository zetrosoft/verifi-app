import pytest
from unittest.mock import MagicMock, patch
from web3 import Web3
from requests.exceptions import ConnectionError # Menggunakan ConnectionError dari requests.exceptions
import json
import os
import sys

# Add the ai-agent directory to the path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import blockchain_service
import config

# Mock configuration values for testing
@pytest.fixture(autouse=True)
def mock_config():
    with patch('config.FUJI_RPC_URL', "http://mock-rpc-url.com"):
        with patch('config.CONTRACT_ADDRESS', "0xMockContractAddress"):
            with patch('config.AI_AGENT_PRIVATE_KEY', "0xmockaiprivatekey"):
                with patch('config.CONTRACT_ABI_PATH', "mock_abi.json"):
                    yield

@pytest.fixture
def mock_w3():
    # Create a mock for Web3.HTTPProvider separately
    with patch('blockchain_service.Web3.HTTPProvider') as mock_http_provider_class:
        mock_http_provider_instance = MagicMock()
        mock_http_provider_class.return_value = mock_http_provider_instance

        with patch('blockchain_service.Web3') as mock_web3_class:
            mock_instance = MagicMock() # Removed spec=Web3
            mock_instance.isConnected.return_value = True
            mock_instance.middleware_onion = MagicMock()
            mock_instance.middleware_onion.inject.return_value = None
            
            # Mock w3.eth and its methods
            mock_instance.eth = MagicMock()
            mock_instance.eth.get_transaction_count.return_value = 0 # Default nonce
            mock_instance.eth.gas_price.return_value = 1000000000 # Default gas price
            mock_instance.eth.account = MagicMock()
            mock_instance.eth.account.from_key.return_value = MagicMock(address="0xMockAIAgentAddress")
            mock_tx_receipt_success = MagicMock()
            mock_tx_receipt_success.status = 1
            mock_tx_receipt_success.transactionHash = "0xmockhash"
            mock_instance.eth.wait_for_transaction_receipt.return_value = mock_tx_receipt_success

            # Mock w3.eth.contract and its functions
            mock_contract_instance = MagicMock()
            mock_contract_instance.functions = MagicMock()
            mock_instance.eth.contract.return_value = mock_contract_instance

            mock_web3_class.return_value = mock_instance
            yield mock_instance

@pytest.fixture
def mock_contract_abi():
    # Create a dummy ABI file for testing
    dummy_abi_path = "mock_abi.json"
    dummy_abi_content = {
        "abi": [
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "_jobId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "_isApproved",
                        "type": "bool"
                    }
                ],
                "name": "verifyWork",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "_jobId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "_releaseToFreelancer",
                        "type": "bool"
                    }
                ],
                "name": "resolveDispute",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "name": "jobs",
                "outputs": [
                    {
                        "internalType": "address payable",
                        "name": "client",
                        "type": "address"
                    },
                    {
                        "internalType": "address payable",
                        "name": "freelancer",
                        "type": "address"
                    },
                    {
                        "internalType": "string",
                        "name": "title",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "descriptionIPFSHash",
                        "type": "string"
                    },
                    {
                        "internalType": "uint256",
                        "name": "price",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "deadline",
                        "type": "uint256"
                    },
                    {
                        "internalType": "string",
                        "name": "resultIPFSHash",
                        "type": "string"
                    },
                    {
                        "internalType": "enum AIEscrowMarketplace.Status",
                        "name": "status",
                        "type": "uint8"
                    },
                    {
                        "internalType": "string",
                        "name": "disputeReason",
                        "type": "string"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ]
    }
    with open(dummy_abi_path, 'w') as f:
        json.dump(dummy_abi_content, f)
    yield dummy_abi_path
    os.remove(dummy_abi_path)

@pytest.fixture(autouse=True)
def reset_globals():
    # Reset global variables before each test to ensure test isolation
    blockchain_service.w3 = None
    blockchain_service.contract = None
    blockchain_service.ai_agent_account = None
    yield

def test_init_contract_success(mock_w3, mock_contract_abi):
    blockchain_service.init_contract()
    assert blockchain_service.w3 is not None
    assert blockchain_service.contract is not None
    assert blockchain_service.ai_agent_account is not None
    mock_w3.isConnected.assert_called_once()

def test_init_contract_connection_error(mock_w3, mock_contract_abi):
    mock_w3.isConnected.return_value = False
    with pytest.raises(ConnectionError):
        blockchain_service.init_contract()
    assert blockchain_service.w3 is None
    assert blockchain_service.contract is None
    assert blockchain_service.ai_agent_account is None

def test_init_contract_abi_file_not_found(mock_w3, mock_config):
    config.CONTRACT_ABI_PATH = "non_existent_abi.json"
    with pytest.raises(FileNotFoundError):
        blockchain_service.init_contract()
    assert blockchain_service.w3 is None
    assert blockchain_service.contract is None
    assert blockchain_service.ai_agent_account is None

def test_init_contract_idempotency(mock_w3, mock_contract_abi):
    blockchain_service.init_contract()
    # Store initial objects
    initial_w3 = blockchain_service.w3
    initial_contract = blockchain_service.contract
    initial_ai_agent_account = blockchain_service.ai_agent_account

    # Call again, should not re-initialize
    blockchain_service.init_contract()
    assert blockchain_service.w3 is initial_w3
    assert blockchain_service.contract is initial_contract
    assert blockchain_service.ai_agent_account is initial_ai_agent_account
    # is_connected should only be called once if idempotent
    mock_w3.isConnected.assert_called_once()

# Helper for mocking transaction sending
@pytest.fixture
def mock_send_transaction(mock_w3):
    with patch('blockchain_service._send_transaction') as mock_tx:
        mock_tx.return_value = {"status": 1, "transactionHash": "0xmockhash"}
        yield mock_tx

def test_send_verification_result(mock_w3, mock_contract_abi, mock_send_transaction):
    blockchain_service.init_contract() # Initialize contract for functions to exist
    blockchain_service.send_verification_result(1, True)
    mock_send_transaction.assert_called_once()
    # You can add more specific assertions about the arguments passed to verifyWork

def test_resolve_dispute_on_chain(mock_w3, mock_contract_abi, mock_send_transaction):
    blockchain_service.init_contract()
    blockchain_service.resolve_dispute_on_chain(1, False)
    mock_send_transaction.assert_called_once()

def test_get_job_details(mock_w3, mock_contract_abi):
    blockchain_service.init_contract()
    
    # Mock the return value of contract.functions.jobs(job_id).call()
    mock_w3.eth.contract.return_value.functions.jobs.return_value.call.return_value = (
        "0xClientAddress", # client
        "0xFreelancerAddress", # freelancer
        "Test Job Title", # title
        "ipfsDescriptionHash", # descriptionIPFSHash
        100, # price
        9999999999, # deadline
        "ipfsResultHash", # resultIPFSHash
        3, # status (WorkSubmitted)
        "Dispute Reason" # disputeReason
    )
    
    details = blockchain_service.get_job_details(1)
    assert details['client'] == "0xClientAddress"
    assert details['title'] == "Test Job Title"
    assert details['price'] == 100
    assert details['status'] == 3

def test_send_transaction_failure(mock_w3, mock_contract_abi):
    # Override the fixture's default mock for a failed transaction receipt
    mock_tx_receipt_failure = MagicMock()
    mock_tx_receipt_failure.status = 0
    mock_w3.eth.wait_for_transaction_receipt.return_value = mock_tx_receipt_failure

    blockchain_service.init_contract()
    # Get the mocked contract instance from mock_w3, as blockchain_service.contract will be the global
    mock_contract_instance = mock_w3.eth.contract.return_value
    mock_function_call = mock_contract_instance.functions.verifyWork(1, True)

    # Expect that _send_transaction doesn't raise an error but returns the failed receipt
    receipt = blockchain_service._send_transaction(mock_function_call)
    assert receipt.status == 0    # Add assertions that print statements were called or logs were generated

# Test cases for listen_for_event are complex due to asyncio and event loop.
# They would typically involve mocking asyncio.sleep and contract.events.create_filter.get_new_entries.
# For MVP, focus on core functions. Event listener testing can be added later.