import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context'; // Adjust path
import AIEscrowMarketplaceArtifact from '../../artifacts/AIEscrowMarketplace.json'; // Adjust path

interface Job {
  jobId: number;
  client: string;
  title: string;
  price: string;
  deadline: string;
}

interface JobBoardProps {
  onViewJobDetails: (jobId: number) => void;
}

const JobBoard: React.FC<JobBoardProps> = ({ onViewJobDetails }) => {
  const { provider } = useWeb3();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';

  const fetchOpenJobs = useCallback(async () => {
    if (!provider) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const contract = new ethers.Contract(contractAddress, AIEscrowMarketplaceArtifact.abi, provider);
      const nextJobId = Number(await contract.getJobCount());
      const fetchedJobs: Job[] = [];

      for (let i = 0; i < nextJobId; i++) {
        const jobData = await contract.jobs(i);
        console.log(`[DEBUG JobBoard] Checking Job ID: ${i}`);
        console.log(`[DEBUG JobBoard] Raw Job Data for ID ${i}:`, jobData);
        console.log(`[DEBUG JobBoard] Status for ID ${i}:`, jobData.status);
        if (Number(jobData.status) === 0) { // Status.Open
          fetchedJobs.push({
            jobId: i,
            client: jobData.client,
            title: jobData.title,
            price: ethers.formatEther(jobData.price),
            deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
          });
        }
      }
      setJobs(fetchedJobs);
    } catch (err: any) {
      console.error('Error fetching open jobs:', err);
      setError(err.reason || err.message || 'Failed to fetch open jobs.');
    } finally {
      setLoading(false);
    }
  }, [provider, contractAddress]);

  useEffect(() => {
    fetchOpenJobs();
  }, [fetchOpenJobs]);

  if (loading) return <div className="p-4">Loading available jobs...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (jobs.length === 0) return <div className="p-4">No open jobs available right now.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Available Jobs</h2>
      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.jobId} className="border rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold">{job.title}</h3>
            <p className="text-sm text-gray-600">Posted by: {job.client.substring(0, 8)}...</p>
            <p><strong>Price:</strong> {job.price} ETH</p>
            <p><strong>Deadline:</strong> {job.deadline}</p>
            <button
                onClick={() => { console.log('View Details & Bid button clicked for Job ID:', job.jobId); onViewJobDetails(job.jobId); }}
                className="mt-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600"
            >
                View Details & Bid
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobBoard;
