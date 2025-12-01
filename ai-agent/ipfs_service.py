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

    ipfs_gateway_url = f"{config.IPFS_API_URL}/cat?arg={ipfs_hash}"
    # If IPFS_API_URL is for content serving directly, like "http://localhost:8080/ipfs"
    # ipfs_gateway_url = f"{config.IPFS_API_URL}/{ipfs_hash}"


    try:
        response = requests.post(ipfs_gateway_url, timeout=30)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        # Create a temporary directory to save the content
        temp_dir = tempfile.mkdtemp(prefix="ipfs_work_")
        
        # Determine filename based on content-disposition header or default
        filename = f"work_{ipfs_hash}"
        if "content-disposition" in response.headers:
            cd = response.headers["content-disposition"]
            fname_match = requests.utils.re.search(r'filename="([^"]+)"', cd)
            if fname_match:
                filename = fname_match.group(1)

        file_path = os.path.join(temp_dir, filename)

        # Save the content to the temporary file
        with open(file_path, 'wb') as f:
            f.write(response.content)
        
        print(f"Downloaded IPFS hash {ipfs_hash} to {file_path}")
        # Return the temporary directory, main.py will need to know the filename inside
        # Or, we return the file_path directly if we expect a single file.
        # For code coverage, we might expect a directory with multiple files.
        # For simplicity, returning the temporary directory path.
        return temp_dir

    except requests.exceptions.HTTPError as errh:
        print(f"HTTP Error: {errh}")
    except requests.exceptions.ConnectionError as errc:
        print(f"Error Connecting: {errc}")
    except requests.exceptions.Timeout as errt:
        print(f"Timeout Error: {errt}")
    except requests.exceptions.RequestException as err:
        print(f"Something Else Error: {err}")
    
    return "" # Return empty string on failure
