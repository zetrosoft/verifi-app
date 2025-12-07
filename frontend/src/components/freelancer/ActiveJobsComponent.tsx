import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ExternalLink, Play } from 'lucide-react'; // Play icon for Submit Work
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getFileContentFromIPFS } from '../../services/IPFSService';
import { toast } from "sonner";
import { Input } from '@/components/ui/input'; // Keep Input for later use in SubmitWorkForm if needed
import { Label } from '@/components/ui/label'; // Keep Label for later use in SubmitWorkForm if needed
import { ethers } from 'ethers'; // For formatting ether
import SubmitWorkForm from './SubmitWorkForm'; // Import the form

// --- Mock Data Toggle ---
const USE_MOCK_DATA = false; // Set to false to use real data from the blockchain

interface ActiveJob {
  jobId: number;
  client: string;
  freelancer: string;
  title: string;
  description: string;
  price: string;
  deadline: string;
  status: number;
  resultIPFSHash?: string; // Optional, if work has been submitted
}

const mockActiveJobs: ActiveJob[] = [
  {
    jobId: 998,
    client: "0xClientAddressHere",
    freelancer: "0xFreelancerPlaceholder", // This will be dynamically set
    title: "Develop a Decentralized Voting App",
    description: "Build a secure and transparent voting application on Avalanche Fuji Testnet with React and Solidity. Key features: creating polls, casting votes, and viewing results.",
    price: "5.0",
    deadline: new Date(Date.now() + 86400000 * 14).toLocaleDateString(), // 14 days from now
    status: 2, // FundsDeposited
    resultIPFSHash: undefined,
  },
  {
    jobId: 999,
    client: "0xAnotherClientAddress",
    freelancer: "0xFreelancerPlaceholder", // This will be dynamically set
    title: "Smart Contract Audit for ERC721",
    description: "Perform a comprehensive security audit of an ERC721 token contract. Focus on reentrancy, integer overflow/underflow, and adherence to ERC721 standards.",
    price: "2.5",
    deadline: new Date(Date.now() + 86400000 * 7).toLocaleDateString(), // 7 days from now
    status: 2, // FundsDeposited
    resultIPFSHash: undefined,
  },
];


const ActiveJobsComponent: React.FC = () => {
  const { provider, account, contract } = useWeb3();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionStates, setSubmissionStates] = useState<{ [jobId: number]: { isSubmitting: boolean; error: string | null; } }>({}); 

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);


  const getStatusInfo = (status: number) => {
    const statuses = [
      { label: 'Open', variant: 'default' },
      { label: 'Assigned', variant: 'secondary' },
      { label: 'Funds Deposited', variant: 'outline' },
      { label: 'Work Submitted', variant: 'warning' },
      { label: 'Verified', variant: 'success' },
      { label: 'Disputed', variant: 'destructive' },
    ];
    return statuses[status] || { label: 'Unknown', variant: 'default' };
  };

  const fetchActiveJobs = useCallback(async () => {
    if (USE_MOCK_DATA) {
      const adaptedMockJobs = mockActiveJobs.map(job => ({
        ...job,
        freelancer: account ? account.toLowerCase() : job.freelancer 
      }));
      setActiveJobs(adaptedMockJobs);
      setLoading(false);
      setError(null); // Clear any previous errors
      return; // Exit as we're using mock data
    }

    // --- REAL DATA FETCHING PATH BELOW ---
    if (!provider || !account || !contract) {
      setActiveJobs([]);
      setLoading(false);
      setError("Wallet not connected or contract not loaded for real data."); // Provide more specific error
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const jobPromises: Promise<ActiveJob | null>[] = [];

      const activeStatuses = [1, 2, 3, 4, 5]; // Assigned, FundsDeposited, WorkSubmitted, Verified, Disputed

      for (let i = 0; i < nextJobId; i++) {
        jobPromises.push((async (): Promise<ActiveJob | null> => {
          const jobData = await contract.jobs(i);
          // Only fetch jobs assigned to the current freelancer and in FundsDeposited state
          if (
            String(jobData.freelancer).toLowerCase() === account.toLowerCase() &&
            activeStatuses.includes(Number(jobData.status))
          ) {
            const description = await getFileContentFromIPFS(jobData.descriptionIPFSHash) || 'Description not available.';
            return {
              jobId: i,
              client: String(jobData.client).toLowerCase(), // Standardize client address
              freelancer: String(jobData.freelancer).toLowerCase(), // Standardize freelancer address
              title: jobData.title,
              description,
              price: ethers.formatEther(jobData.price),
              deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
              status: Number(jobData.status),
              resultIPFSHash: jobData.resultIPFSHash,
            };
          }
          return null;
        })());
      }

      const resolvedJobs = (await Promise.all(jobPromises)).filter((job): job is ActiveJob => job !== null);
      setActiveJobs(resolvedJobs.reverse());
    } catch (err: any) {
      setError(err.reason || err.message || 'Failed to fetch active jobs.');
      console.error("ActiveJobsComponent: Error fetching real data:", err); // Diagnostic error log
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract]);

  useEffect(() => {
    fetchActiveJobs();
  }, [fetchActiveJobs]);
  
  const handleOpenSubmitModal = (jobId: number) => {
    setSelectedJobId(jobId);
    setIsSubmitModalOpen(true);
  };

  const handleWorkSubmitted = () => {
    fetchActiveJobs(); // Refresh the list after submission
  };

  // handleIpfsHashChange and handleSubmitWork are now part of SubmitWorkForm.tsx

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (activeJobs.length === 0) return <p className="p-4 text-center text-muted-foreground">No active jobs found.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Active Jobs</h2>
      {activeJobs.map((job) => {
        const submissionState = submissionStates[job.jobId] || { isSubmitting: false, error: null };
        return (
          <Card key={job.jobId}>
            <CardHeader>
              <CardTitle>{job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Job ID: {job.jobId}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{job.description}</p>
              <Separator className="my-2" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span><strong>Price:</strong> {job.price} AVAX</span>
                <span><strong>Client:</strong> {job.client.substring(0, 6)}...</span>
                <span><strong>Deadline:</strong> {job.deadline}</span>
              </div>

              {job.status === 2 && ( // FundsDeposited
                <Button onClick={() => handleOpenSubmitModal(job.jobId)}>Submit Work</Button>
              )}
              {job.status === 3 && <Badge className="mt-4 bg-yellow-500 text-black">Work Submitted, awaiting AI verification.</Badge>}
              {job.status === 4 && <Badge className="mt-4 bg-teal-500">Verified by AI. Client can now approve funds.</Badge>}
              {job.status === 5 && <Badge className="mt-4 bg-red-500">Disputed. Awaiting resolution.</Badge>}
              {job.status === 6 && <Badge className="mt-4 bg-purple-500">Completed. Funds released.</Badge>}
              {job.status === 7 && <Badge className="mt-4 bg-red-700">Cancelled.</Badge>}
              
            </CardContent>
          </Card>
        );
      })}

      {selectedJobId !== null && (
        <SubmitWorkForm
            jobId={selectedJobId}
            open={isSubmitModalOpen}
            onOpenChange={setIsSubmitModalOpen}
            onWorkSubmitted={handleWorkSubmitted}
        />
      )}
    </div>
  );
};

export default ActiveJobsComponent;