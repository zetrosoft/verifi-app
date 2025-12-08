import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context'; // Adjust path as necessary
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json'; // Adjust path

interface JobPostingFormProps {
  onJobPosted: () => void; // Callback to refresh job list
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({ onJobPosted }) => {
  const { signer, account, provider } = useWeb3();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState('weeks'); // 'days', 'weeks', 'months'
  const [ipfsHash, setIpfsHash] = useState(''); // This would come from an IPFS upload service
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI Feasibility Check States
  const [isFeasible, setIsFeasible] = useState<boolean | null>(null);
  const [feasibilityReason, setFeasibilityReason] = useState<string | null>(null);
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';
  const aiAgentApiUrl = import.meta.env.VITE_AI_AGENT_API_URL || 'http://localhost:8000/api/v1'; // Default AI Agent URL

  // --- Feasibility Check Logic ---
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (title && description && ipfsHash) { // ipfsHash represents requirements for AI check
        setCheckingFeasibility(true);
        setIsFeasible(null);
        setFeasibilityReason(null);

        fetch(`${aiAgentApiUrl}/check-job-feasibility`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            description, // Using description as requirements for AI Agent
            requirements: description, // Explicitly pass description as requirements
          }),
        })
          .then(response => response.json())
          .then(data => {
            setIsFeasible(data.feasible);
            setFeasibilityReason(data.reason);
          })
          .catch(err => {
            console.error('Error checking job feasibility:', err);
            setIsFeasible(false);
            setFeasibilityReason('Failed to connect to AI Agent for feasibility check.');
          })
          .finally(() => {
            setCheckingFeasibility(false);
          });
      } else {
        setIsFeasible(null);
        setFeasibilityReason(null);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(debounceTimeout);
  }, [title, description, ipfsHash, aiAgentApiUrl]);


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
    if (!isFeasible) { // Ensure AI has deemed it feasible
        setError(feasibilityReason || 'Job is not feasible according to AI Agent. Please revise.');
        return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, signer);

      const priceInWei = ethers.parseEther(price);
      
      let durationInSeconds = 0;
      const val = parseInt(durationValue, 10);
      if (durationUnit === 'days') {
        durationInSeconds = val * 24 * 60 * 60;
      } else if (durationUnit === 'weeks') {
        durationInSeconds = val * 7 * 24 * 60 * 60;
      } else if (durationUnit === 'months') {
        durationInSeconds = val * 30 * 24 * 60 * 60; // Approximation
      }

      console.log("Duration Value:", durationValue);
      console.log("Duration Unit:", durationUnit);
      console.log("Duration in Seconds:", durationInSeconds);

      const provider = signer.provider;
      if (!provider) {
        throw new Error("Provider not found");
      }
      const latestBlock = await provider.getBlock('latest');
      if (!latestBlock) {
        throw new Error("Could not get latest block");
      }
      console.log("Latest Block Timestamp:", latestBlock.timestamp);
      
      const deadlineTimestamp = latestBlock.timestamp + durationInSeconds;
      console.log("Calculated Deadline Timestamp:", deadlineTimestamp);


      const tx = await contract.postJob(title, ipfsHash, priceInWei, deadlineTimestamp);
      await tx.wait();

      setSuccess('Job posted successfully!');
      setTitle('');
      setDescription('');
      setPrice('');
      setDurationValue('1');
      setDurationUnit('weeks');
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
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Harga (AVAX)</label>
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
              <label className="block text-sm font-medium text-gray-700">Durasi Pekerjaan</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="1"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  required
                />
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  required
                >
                  <option value="days">Hari</option>
                  <option value="weeks">Minggu</option>
                  <option value="months">Bulan</option>
                </select>
              </div>
            </div>
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
          type="button"
          className="w-full px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50"
        >
            Jalankan Pengecekan Kelayakan AI
        </button>

        {checkingFeasibility && (
            <p className="text-blue-500">Checking job feasibility with AI Agent...</p>
        )}
        {isFeasible === false && (
            <p className="text-red-500">AI Feasibility Check Failed: {feasibilityReason}</p>
        )}
        {isFeasible === true && (
            <p className="text-green-500">AI Feasibility Check Passed!</p>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50"
          disabled={loading || !isFeasible || checkingFeasibility} // Disable if not feasible or checking
        >
          {loading ? 'Posting Pekerjaan...' : 'Posting Pekerjaan'}
        </button>
      </form>
    </div>
  );
};

export default JobPostingForm;