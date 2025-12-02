import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context'; // Adjust path
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json'; // Adjust path

interface Job {
  jobId: number;
  client: string;
  freelancer: string;
  title: string;
  descriptionIPFSHash: string;
  price: string; // In ETH
  deadline: string; // Formatted date
  status: number;
  bidCount: number;
}

interface MyPostedJobsProps {
  onViewBids: (jobId: number) => void;
  refreshTrigger: number; // To trigger refetch when a job is posted or bid accepted
}

const MyPostedJobs: React.FC<MyPostedJobsProps> = ({ onViewBids, refreshTrigger }) => {
  const { provider, account } = useWeb3();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';

  const fetchMyPostedJobs = useCallback(async () => {
    if (!provider || !account) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, provider);
      // In a real app, we'd query jobsByClient mapping for efficiency
      // For now, we'll iterate through all jobs (up to nextJobId) which is inefficient for large scale
      const nextJobId = Number(await contract.getJobCount());
      const fetchedJobs: Job[] = [];

      for (let i = 0; i < nextJobId; i++) {
        const jobData = await contract.jobs(i);
        if (jobData.client.toLowerCase() === account.toLowerCase()) {
            const bids = await contract.getBidsForJob(i); // Fetch bids to count them
            fetchedJobs.push({
                jobId: i,
                client: jobData.client,
                freelancer: jobData.freelancer,
                title: jobData.title,
                descriptionIPFSHash: jobData.descriptionIPFSHash,
                price: ethers.formatEther(jobData.price),
                deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
                status: jobData.status,
                bidCount: bids.length,
            });
        }
      }
      setJobs(fetchedJobs);
    } catch (err: any) {
      console.error('Error fetching posted jobs:', err);
      setError(err.reason || err.message || 'Failed to fetch posted jobs.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contractAddress]);

  useEffect(() => {
    fetchMyPostedJobs();
  }, [fetchMyPostedJobs, refreshTrigger]);

  if (loading) return <div className="p-4">Loading your posted jobs...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (jobs.length === 0) return <div className="p-4">You haven't posted any jobs yet.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">My Posted Jobs</h2>
      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.jobId} className="border rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold">{job.title}</h3>
            <p><strong>Price:</strong> {job.price} ETH</p>
            <p><strong>Deadline:</strong> {job.deadline}</p>
            <p><strong>Status:</strong> {['Open', 'Assigned', 'FundsDeposited', 'WorkSubmitted', 'Verified', 'Completed', 'Cancelled'][job.status]}</p>
            <p><strong>Bids:</strong> {job.bidCount}</p>
            {job.status === 0 && ( // Only show View Bids button if job is Open
                <button
                    onClick={() => onViewBids(job.jobId)}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600"
                >
                    View Bids ({job.bidCount})
                </button>
            )}
            {job.status === 1 && ( // Assigned, awaiting deposit
                <p className="mt-2 text-sm text-gray-600">Awaiting deposit from client.</p>
            )}
            {job.status === 2 && ( // FundsDeposited, work in progress
                <p className="mt-2 text-sm text-gray-600">Work in progress by {job.freelancer.substring(0,6)}...</p>
            )}
            {job.status === 3 && ( // WorkSubmitted
                <p className="mt-2 text-sm text-gray-600">Work submitted, awaiting AI verification.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPostedJobs;
