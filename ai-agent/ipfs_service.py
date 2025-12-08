import requests
import os
import tempfile
import config


def download_work_from_ipfs(ipfs_hash: str) -> str:
    """
    Downloads content from IPFS using the configured IPFS API URL.
    Returns the path to a temporary directory where the content is saved.
    """
    # Assuming IPFS_API_URL points to a gateway, not the API endpoint.
    # For actual IPFS API interaction (add, cat, etc.), config.IPFS_API_URL should be the API base URL.
    # For simplicity, this assumes a public gateway or a local gateway configured to serve content via HTTP GET.
    # A more robust solution would use an IPFS client library.

    # Example: http://localhost:8080/ipfs/<ipfs_hash> or https://ipfs.io/ipfs/<ipfs_hash>
    # If config.IPFS_API_URL is "http://localhost:5001/api/v0", then we need to adjust.
    # For now, let's assume IPFS_API_URL is the base URL for fetching content directly.
    # A proper IPFS API client (e.g., go-ipfs-api, py-ipfs-http-client) would be better.

    ipfs_cat_url = f"{config.IPFS_API_URL}/api/v0/cat"

    try:
        # IPFS cat expects the hash as a query parameter
        response = requests.post(ipfs_cat_url, params={"arg": ipfs_hash}, timeout=30)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)

        # Create a temporary directory to save the content
        temp_dir = tempfile.mkdtemp(prefix="ipfs_work_")

        # For 'cat' command, we generally get the raw file content.
        # We need to decide on a filename. For now, use the hash itself.
        file_path = os.path.join(
            temp_dir, ipfs_hash
        )  # Use hash as filename for simplicity

        # Save the content to the temporary file
        with open(file_path, "wb") as f:
            f.write(response.content)

        print(f"Downloaded IPFS hash {ipfs_hash} to {file_path}")
        return temp_dir  # Return the temporary directory path

    except requests.exceptions.HTTPError as errh:
        print(f"HTTP Error: {errh}")
    except requests.exceptions.ConnectionError as errc:
        print(f"Error Connecting: {errc}")
    except requests.exceptions.Timeout as errt:
        print(f"Timeout Error: {errt}")
    except requests.exceptions.RequestException as err:
        print(f"Something Else Error: {err}")

    return ""  # Return empty string on failure


def upload_file_to_ipfs(file_path: str) -> str:
    """
    Uploads a file to IPFS and returns its hash.
    """
    ipfs_add_url = f"{config.IPFS_API_URL}/api/v0/add"

    try:
        with open(file_path, "rb") as f:
            files = {"file": f}
            response = requests.post(ipfs_add_url, files=files, timeout=30)
            response.raise_for_status()

            result = response.json()
            ipfs_hash = result["Hash"]
            print(f"Uploaded {file_path} to IPFS with hash: {ipfs_hash}")
            return ipfs_hash

    except requests.exceptions.HTTPError as errh:
        print(f"HTTP Error during IPFS upload: {errh}")
    except requests.exceptions.ConnectionError as errc:
        print(f"Error Connecting during IPFS upload: {errc}")
    except requests.exceptions.Timeout as errt:
        print(f"Timeout Error during IPFS upload: {errt}")
    except requests.exceptions.RequestException as err:
        print(f"Something Else Error during IPFS upload: {err}")

    return ""  # Return empty string on failure


def get_file_content_from_ipfs(ipfs_hash: str) -> str:
    """
    Retrieves the content of a text file from IPFS given its hash.
    """
    ipfs_cat_url = f"{config.IPFS_API_URL}/api/v0/cat"

    try:
        response = requests.post(ipfs_cat_url, params={"arg": ipfs_hash}, timeout=30)
        response.raise_for_status()
        print(f"Fetched content for IPFS hash {ipfs_hash}")
        return response.text

    except requests.exceptions.HTTPError as errh:
        print(f"HTTP Error fetching IPFS content: {errh}")
    except requests.exceptions.ConnectionError as errc:
        print(f"Error Connecting fetching IPFS content: {errc}")
    except requests.exceptions.Timeout as errt:
        print(f"Timeout Error fetching IPFS content: {errt}")
    except requests.exceptions.RequestException as err:
        print(f"Something Else Error fetching IPFS content: {err}")

    return ""  # Return empty string on failure
