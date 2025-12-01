import json
import time
import asyncio
from web3 import Web3
from web3.middleware import geth_poa_middleware
import config

w3 = None
contract = None

def init_contract():
    """
    Initializes Web3 connection and contract instance.
    """
    global w3, contract
    if w3 is None or contract is None:
        try:
            w3 = Web3(Web3.HTTPProvider(config.FUJI_RPC_URL))

            # Add PoA middleware for Avalanche Fuji Testnet
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            if not w3.is_connected():
                raise ConnectionError(f"Failed to connect to Web3 provider at {config.FUJI_RPC_URL}")

            with open(config.CONTRACT_ABI_PATH, 'r') as f:
                contract_data = json.load(f)
            contract_abi = contract_data['abi']

            contract = w3.eth.contract(address=config.CONTRACT_ADDRESS, abi=contract_abi)
            print("Web3 and contract initialized successfully.")
        except Exception as e:
            print(f"Error initializing Web3 or contract: {e}")
            raise
    return w3, contract

async def listen_for_events(callback_function):
    """
    Listens for WorkSubmitted events and calls a callback function.
    """
    _, contract = init_contract()
    print(f"Listening for WorkSubmitted events on contract {config.CONTRACT_ADDRESS}...")

    event_filter = contract.events.WorkSubmitted.create_filter(fromBlock='latest')

    while True:
        try:
            for event in event_filter.get_new_entries():
                print(f"Received WorkSubmitted event: {event.args}")
                callback_function(event)
            await asyncio.sleep(5)  # Poll every 5 seconds
        except Exception as e:
            print(f"Error while listening for events: {e}")
            # Re-initialize web3 and contract in case of connection issues
            w3 = None
            contract = None
            init_contract()
            await asyncio.sleep(10) # Wait longer before retrying

def send_verification_result(job_id: int, is_approved: bool):
    """
    Sends the verification result to the smart contract.
    """
    w3, contract = init_contract()
    
    # Get the AI agent's account
    ai_agent_account = w3.eth.account.from_private_key(config.AI_AGENT_PRIVATE_KEY)
    
    # Build the transaction
    nonce = w3.eth.get_transaction_count(ai_agent_account.address)
    tx = contract.functions.verifyWork(job_id, is_approved).build_transaction({
        'from': ai_agent_account.address,
        'nonce': nonce,
        'gas': 2000000, # This might need adjustment
        'gasPrice': w3.eth.gas_price
    })

    # Sign the transaction
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=config.AI_AGENT_PRIVATE_KEY)

    # Send the transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    print(f"Transaction sent: {tx_hash.hex()}")

    # Wait for the transaction receipt
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"Transaction receipt: {tx_receipt}")

    if tx_receipt.status == 1:
        print(f"Job {job_id} verification successful. Approved: {is_approved}")
    else:
        print(f"Job {job_id} verification failed. Approved: {is_approved}")
    
    return tx_receipt
