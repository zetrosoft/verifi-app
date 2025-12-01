import asyncio
import os
import shutil
import blockchain_service
import ipfs_service
import verification_service
import config

async def event_callback(event):
    """
    Callback function to process WorkSubmitted events.
    """
    job_id = event.args.jobId
    freelancer_address = event.args.freelancer
    result_ipfs_hash = event.args.resultIPFSHash

    print(f"Processing Job ID: {job_id}, Freelancer: {freelancer_address}, IPFS Hash: {result_ipfs_hash}")

    # 1. Download work from IPFS
    downloaded_work_path = ipfs_service.download_work_from_ipfs(result_ipfs_hash)

    if not downloaded_work_path:
        print(f"Failed to download work for Job ID {job_id} from IPFS. Skipping verification.")
        # Optionally send a failed verification result or mark as disputed
        blockchain_service.send_verification_result(job_id, False)
        return

    try:
        # 2. Verify code coverage
        is_approved = verification_service.verify_code_coverage(downloaded_work_path)
        print(f"Verification result for Job ID {job_id}: {'Approved' if is_approved else 'Rejected'}")

        # 3. Send verification result to blockchain
        blockchain_service.send_verification_result(job_id, is_approved)

    except Exception as e:
        print(f"An error occurred during verification process for Job ID {job_id}: {e}")
        # In case of any error, send a rejection to the blockchain
        blockchain_service.send_verification_result(job_id, False)
    finally:
        # Clean up temporary directory
        if os.path.exists(downloaded_work_path):
            shutil.rmtree(downloaded_work_path)
            print(f"Cleaned up temporary directory: {downloaded_work_path}")

async def main():
    """
    Main function to initialize services and start event listening.
    """
    print("Starting AI Agent Orchestrator...")
    
    # Initialize blockchain service (connects to Web3 and contract)
    try:
        blockchain_service.init_contract()
    except Exception as e:
        print(f"Critical error during blockchain service initialization: {e}")
        return # Exit if we can't connect to blockchain

    # Start listening for events
    await blockchain_service.listen_for_events(event_callback)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("AI Agent Orchestrator stopped by user.")
    except Exception as e:
        print(f"An unhandled error occurred in the main loop: {e}")
