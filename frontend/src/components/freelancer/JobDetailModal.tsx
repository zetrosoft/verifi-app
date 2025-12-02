import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json';

interface JobDetail {
  title: string;
  price: string;
  deadline: string;
  descriptionIPFSHash: string;
}

interface JobDetailModalProps {
  jobId: number | null;
  onClose: () => void;
  onBidSubmitted: () => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ jobId, onClose, onBidSubmitted }) => {
  const { provider, signer, account } = useWeb3();
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';

  const fetchJobDetails = useCallback(async () => {
    console.log('[DEBUG JobDetailModal] Fetching details for jobId:', jobId);
    if (jobId === null || !provider) { // Changed !jobId to jobId === null
      setLoading(false);
      console.warn('[DEBUG JobDetailModal] No jobId or provider, aborting fetch.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, provider);
      const jobData = await contract.jobs(jobId);
      console.log('[DEBUG JobDetailModal] Fetched jobData:', jobData);
      setJobDetail({
        title: jobData.title,
        price: ethers.formatEther(jobData.price),
        deadline: new Date(Number(jobData.deadline) * 1000).toLocaleString(),
        descriptionIPFSHash: jobData.descriptionIPFSHash,
      });
    } catch (err: any) {
      console.error('[DEBUG JobDetailModal] Error fetching job details:', err);
      setError(err.reason || err.message || 'Failed to fetch job details.');
    } finally {
      setLoading(false);
    }
  }, [jobId, provider, contractAddress]);

  useEffect(() => {
    if (jobId !== null) { // Only fetch if jobId is provided
      fetchJobDetails();
    }
  }, [fetchJobDetails, jobId]); // Add jobId to dependency array

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !account || jobId === null) {
      setError('Please connect your wallet to submit a bid.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, signer);
      const tx = await contract.submitBid(jobId, proposal);
      await tx.wait();
      onBidSubmitted();
      onClose();
    } catch (err: any) {
      console.error('[DEBUG JobDetailModal] Error submitting bid:', err);
      setError(err.reason || err.message || 'Failed to submit bid.');
    } finally {
      setSubmitting(false);
    }
  };

  if (jobId === null) return null; // Render nothing if no jobId

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center"> {/* Added z-50 */}
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full relative"> {/* Added relative for potential close button positioning */}
        {loading ? (
          <p>Loading details...</p>
        ) : error ? (
          <>
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Close</button>
          </>
        ) : jobDetail ? (
          <>
            <h2 className="text-2xl font-bold mb-4">{jobDetail.title}</h2>
            <p><strong>Price:</strong> {jobDetail.price} ETH</p>
            <p><strong>Deadline:</strong> {jobDetail.deadline}</p>
            <p><strong>Description Hash:</strong> {jobDetail.descriptionIPFSHash}</p>
            <hr className="my-4"/>
            <form onSubmit={handleSubmitBid}>
              <h3 className="text-lg font-semibold mb-2">Submit Your Bid</h3>
              <textarea
                className="w-full border p-2 rounded-md"
                rows={4}
                placeholder="Write your proposal here..."
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                required
              />
              <div className="mt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Bid'}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default JobDetailModal;
