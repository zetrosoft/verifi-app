import json
import time
import asyncio
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
import config

import requests

# Global variables for Web3 connection
w3 = None
contract = None
ai_agent_account = None

def init_contract():
    """
    Initializes Web3 connection, contract instance, and AI agent account.
    This function is now idempotent.
    """
    global w3, contract, ai_agent_account
    if w3 and contract and ai_agent_account:
        return

    try:
        print("Initializing Web3, contract, and AI agent account...")
        w3 = Web3(Web3.HTTPProvider(config.FUJI_RPC_URL))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not w3.is_connected():
            raise requests.exceptions.ConnectionError(f"Failed to connect to Web3 provider at {config.FUJI_RPC_URL}")

        with open(config.CONTRACT_ABI_PATH, 'r') as f:
            contract_data = json.load(f)
        contract_abi = contract_data['abi']

        contract = w3.eth.contract(address=config.CONTRACT_ADDRESS, abi=contract_abi)
        ai_agent_account = w3.eth.account.from_key(config.AI_AGENT_PRIVATE_KEY)
        
        print("Web3, contract, and AI agent account initialized successfully.")
        print(f"AI Agent Address: {ai_agent_account.address}")

    except Exception as e:
        print(f"CRITICAL: Error initializing Web3 or contract: {e}")
        # Reset globals on failure to allow retry
        w3 = contract = ai_agent_account = None
        raise

async def listen_for_event(event_name: str, callback_function):
    """
    Listens for a specific event and calls an async callback function.
    """
    global w3, contract
    print(f"Starting listener for '{event_name}' events on contract {config.CONTRACT_ADDRESS}...")

    last_block_number = w3.eth.block_number

    while True:
        try:
            # Ensure services are initialized
            if not w3 or not contract:
                init_contract()

            # Dynamically get the event from the contract ABI
            event_filter = getattr(contract.events, event_name).create_filter(fromBlock=last_block_number + 1)

            for event in event_filter.get_new_entries():
                print(f"Received '{event_name}' event: {event.args}")
                await callback_function(event)
            
            # Update last_block_number after processing events
            last_block_number = w3.eth.block_number

            await asyncio.sleep(5)  # Poll every 5 seconds

        except Exception as e:
            print(f"Error in '{event_name}' listener: {e}. Re-initializing...")
            # Reset globals to force re-initialization
            w3 = contract = ai_agent_account = None
            await asyncio.sleep(10) # Wait longer before retrying

def _send_transaction(function_call):
    """
    Helper function to build, sign, and send a transaction.
    """
    init_contract()
    
    nonce = w3.eth.get_transaction_count(ai_agent_account.address)
    tx = function_call.build_transaction({
        'from': ai_agent_account.address,
        'nonce': nonce,
        'gas': 2000000,  # Adjust as needed
        'gasPrice': w3.eth.gas_price
    })

    signed_tx = w3.eth.account.sign_transaction(tx, private_key=config.AI_AGENT_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    print(f"Transaction sent: {tx_hash.hex()}")

    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"Transaction receipt status: {'Success' if tx_receipt.status == 1 else 'Failed'}")
    
    return tx_receipt

def send_verification_result(job_id: int, is_approved: bool):
    """
    Sends the verification result to the smart contract by calling verifyWork.
    """
    print(f"Sending verification for Job ID {job_id}. Approved: {is_approved}")
    function_call = contract.functions.verifyWork(job_id, is_approved)
    return _send_transaction(function_call)

def resolve_dispute_on_chain(job_id: int, release_to_freelancer: bool):
    """
    Sends the dispute resolution to the smart contract by calling resolveDispute.
    """
    print(f"Sending dispute resolution for Job ID {job_id}. Release to freelancer: {release_to_freelancer}")
    function_call = contract.functions.resolveDispute(job_id, release_to_freelancer)
    return _send_transaction(function_call)

def get_job_details(job_id: int) -> dict:
    """
    Retrieves job details from the smart contract for a given job ID.
    """
    init_contract()
    print(f"Fetching details for Job ID: {job_id}")
    
    # The contract's 'jobs' mapping returns a tuple
    job_tuple = contract.functions.jobs(job_id).call()
    
    # Map the tuple to a dictionary based on the Job struct in Solidity
    job_details = {
        'client': job_tuple[0],
        'freelancer': job_tuple[1],
        'title': job_tuple[2],
        'descriptionIPFSHash': job_tuple[3],
        'price': job_tuple[4],
        'deadline': job_tuple[5],
        'resultIPFSHash': job_tuple[6],
        'status': job_tuple[7],
        'disputeReason': job_tuple[8]
    }
    return job_details