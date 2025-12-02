import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json';

interface Bid {
  bidId: number;
  jobId: number;
  freelancer: string;
  proposalText: string;
}

interface ViewBidsProps {
  jobId: number | null;
  onBack: () => void;
  onBidAccepted: () => void; // Callback to refresh job lists after bid acceptance
}

const ViewBids: React.FC<ViewBidsProps> = ({ jobId, onBack, onBidAccepted }) => {
  const { provider, signer, account } = useWeb3();
  const [bids, setBids] = useState<Bid[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingBid, setAcceptingBid] = useState<number | null>(null);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';

  const fetchBids = useCallback(async () => {
    if (!jobId || !provider) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, provider);
      const fetchedBids: Bid[] = [];
      const jobData = await contract.jobs(jobId);
      setJobTitle(jobData.title);

      const contractBids = await contract.bidsByJobId(jobId);
      for (let i = 0; i < contractBids.length; i++) {
        const bid = contractBids[i];
        fetchedBids.push({
          bidId: bid.bidId,
          jobId: bid.jobId,
          freelancer: bid.freelancer,
          proposalText: bid.proposalText,
        });
      }
      setBids(fetchedBids);
    } catch (err: any) {
      console.error('Error fetching bids:', err);
      setError(err.reason || err.message || 'Failed to fetch bids.');
    } finally {
      setLoading(false);
    }
  }, [jobId, provider, contractAddress]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  const handleAcceptBid = async (bidId: number) => {
    if (!signer || !account || jobId === null) {
      setError('Wallet not connected or job not selected.');
      return;
    }

    setAcceptingBid(bidId);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, signer);
      const tx = await contract.acceptBid(jobId, bidId);
      await tx.wait();
      onBidAccepted(); // Callback to refresh relevant components
      onBack(); // Go back to job list
    } catch (err: any) {
      console.error('Error accepting bid:', err);
      setError(err.reason || err.message || 'Failed to accept bid.');
    } finally {
      setAcceptingBid(null);
    }
  };

  if (!jobId) return <div className="p-4">Select a job to view bids.</div>;
  if (loading) return <div className="p-4">Loading bids...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <button onClick={onBack} className="mb-4 px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
        &larr; Back to My Jobs
      </button>
      <h2 className="text-xl font-bold mb-4">Bids for "{jobTitle}" (Job ID: {jobId})</h2>
      {bids.length === 0 ? (
        <p>No bids yet for this job.</p>
      ) : (
        <div className="space-y-4">
          {bids.map((bid) => (
            <div key={bid.bidId} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold">Freelancer: {bid.freelancer.substring(0, 8)}...</h3>
              <p><strong>Proposal:</strong> {bid.proposalText}</p>
              <button
                onClick={() => handleAcceptBid(bid.bidId)}
                className="mt-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 disabled:opacity-50"
                disabled={acceptingBid === bid.bidId}
              >
                {acceptingBid === bid.bidId ? 'Accepting...' : 'Accept Bid'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewBids;
