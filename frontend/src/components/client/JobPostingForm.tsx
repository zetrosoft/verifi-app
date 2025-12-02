import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context'; // Adjust path as necessary
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json'; // Adjust path

interface JobPostingFormProps {
  onJobPosted: () => void; // Callback to refresh job list
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({ onJobPosted }) => {
  const { signer, account } = useWeb3();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ipfsHash, setIpfsHash] = useState(''); // This would come from an IPFS upload service
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS'; // Replace with actual contract address from .env or config

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !account) {
      setError('Please connect your wallet.');
      return;
    }
    if (ipfsHash === '') {
        setError('IPFS Hash for description is required.');
        return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, signer);

      // Convert price to wei and deadline to Unix timestamp
      const priceInWei = ethers.parseEther(price);
      const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);

      const tx = await contract.postJob(title, ipfsHash, priceInWei, deadlineTimestamp);
      await tx.wait(); // Wait for the transaction to be mined

      setSuccess('Job posted successfully!');
      setTitle('');
      setDescription('');
      setPrice('');
      setDeadline('');
      setIpfsHash('');
      onJobPosted(); // Trigger refresh
    } catch (err: any) {
      console.error('Error posting job:', err);
      setError(err.reason || err.message || 'Failed to post job.');
    } finally {
      setLoading(false);
    }
  };

  // Dummy IPFS upload handler for now
  const handleIpfsUpload = async () => {
    alert('Simulating IPFS upload. In a real app, this would upload description and requirements and return a hash.');
    // Replace with actual IPFS service call
    setIpfsHash('QmDUMMYIPFSHASH1234567890abcdefghijklmnopqrstuvwxyz');
  };

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Post a New Job</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-500 mb-2">{success}</p>}
      <form onSubmit={handlePostJob} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Price (ETH)</label>
          <input
            type="number"
            step="0.01"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Deadline</label>
          <input
            type="date"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">IPFS Hash (for Description/Requirements)</label>
            <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100"
                value={ipfsHash}
                readOnly
                placeholder="Upload content to IPFS to get a hash"
            />
            <button
                type="button"
                onClick={handleIpfsUpload}
                className="mt-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600"
            >
                Upload to IPFS (Dummy)
            </button>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Posting Job...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
};

export default JobPostingForm;
