import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getFileContentFromIPFS } from '../../services/IPFSService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DisputeForm from './DisputeForm';
import { toast } from "sonner";
import DepositModal from './DepositModal';
import FreelancerInfoModal from './FreelancerInfoModal';

// Updated Job interface
interface Job {
  jobId: number;
  client: string;
  freelancer: string;
  title: string;
  description: string;
  price: string;
  deadline: string;
  postDate: string;
  txHash: string;
  status: number;
  bidCount: number;
  bids: any[]; // To store full bid data
  disputeReason?: string;
}

interface MyPostedJobsProps {
  onViewBids: (jobId: number) => void;
  onRaiseDispute: (jobId: number) => void;
  refreshTrigger: number;
}

// Single Job Card Component
const JobCard: React.FC<{ 
    job: Job; 
    onReleaseFunds: (jobId: number) => void; 
    handleRaiseDisputeClick: (jobId: number) => void; 
    onViewBids: (jobId: number) => void; 
    onOpenDepositModal: (jobId: number, priceAVAX: string) => void;
    onViewFreelancer: (job: Job) => void; // New prop
    actionState: { [key: string]: boolean }; 
}> = ({ job, onReleaseFunds, handleRaiseDisputeClick, onViewBids, onOpenDepositModal, onViewFreelancer, actionState }) => {

  const truncateTitle = (title: string, wordLimit: number) => {
    const words = title.split(' ');
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return title;
  };

  const getStatusBadge = (status: number) => {
    const statuses = [
        { label: 'Open', className: 'bg-green-500 hover:bg-green-600' },
        { label: 'Assigned', className: 'bg-gray-500' },
        { label: 'Funds Deposited', className: 'bg-blue-500' },
        { label: 'Work Submitted', className: 'bg-yellow-500 text-black' },
        { label: 'Verified', className: 'bg-teal-500' },
        { label: 'Disputed', className: 'bg-red-500' },
        { label: 'Completed', className: 'bg-purple-500' },
        { label: 'Cancelled', className: 'bg-red-700' },
    ];
    const statusInfo = statuses[status] || { label: 'Unknown', className: 'bg-gray-400' };
    return <Badge className={cn("text-white", statusInfo.className)}>{statusInfo.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-left text-lg font-semibold cursor-pointer">
                  {truncateTitle(job.title, 5)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p><strong>{job.title}</strong> (ID: {job.jobId})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {getStatusBadge(job.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{job.description}</p>
        
        <Separator />
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span><strong>Price:</strong> {job.price} AVAX</span>
          <span><strong>Post Date:</strong> {job.postDate}</span>
          <span><strong>Deadline:</strong> {job.deadline}</span>
          <span>
            <strong>Freelancer:</strong>{' '}
            {job.freelancer === ethers.ZeroAddress ? (
              "Not assigned"
            ) : (
              <Button variant="link" className="p-0 h-auto" onClick={() => onViewFreelancer(job)}>
                {`${job.freelancer.substring(0, 6)}...${job.freelancer.substring(job.freelancer.length - 4)}`}
              </Button>
            )}
          </span>
          <span><strong>Bids:</strong> {job.bidCount}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <div className="flex flex-wrap gap-2">
                {job.status === 0 && ( // Open
                    <Button variant="default" onClick={() => onViewBids(job.jobId)} disabled={actionState[job.jobId]}>
                        View Bids ({job.bidCount})
                    </Button>
                )}
                {job.status === 1 && ( // Assigned, awaiting deposit
                    <Button 
                      variant="default" 
                      onClick={() => onOpenDepositModal(job.jobId, job.price)} 
                      disabled={actionState[`deposit-${job.jobId}`]} 
                    >
                      {actionState[`deposit-${job.jobId}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Deposit Funds"}
                    </Button>
                )}
                {job.status === 2 && <Badge variant="outline">Work in progress by {job.freelancer.substring(0,6)}...</Badge>}
                {job.status === 3 && <Badge variant="warning">Work submitted, awaiting AI verification.</Badge>}
                {job.status === 4 && ( // Verified
                <>
                    <Button variant="default" onClick={() => onReleaseFunds(job.jobId)} disabled={actionState[`release-${job.jobId}`]}>
                        {actionState[`release-${job.jobId}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Approve & Release Funds"}
                    </Button>
                    <Button variant="destructive" onClick={() => handleRaiseDisputeClick(job.jobId)} disabled={actionState[`dispute-${job.jobId}`]}>
                        Raise Dispute
                    </Button>
                </>
                )}
                {job.status === 5 && <Alert variant="warning" className="w-full"><AlertTitle>Disputed</AlertTitle><AlertDescription>Reason: "{job.disputeReason}"</AlertDescription></Alert>}
                {job.status === 6 && <Badge variant="success">Completed</Badge>}
                {job.status === 7 && <Badge variant="destructive">Cancelled</Badge>}
            </div>
            {job.txHash && job.txHash !== '#' && (
                <Button variant="outline" size="sm" asChild>
                    <a href={`https://testnet.snowtrace.io/tx/${job.txHash}`} target="_blank" rel="noopener noreferrer">
                        View Tx <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
};


// Main Component
const MyPostedJobs: React.FC<MyPostedJobsProps> = ({ onViewBids, onRaiseDispute, refreshTrigger }) => {
  const { provider, account, contract } = useWeb3();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ [key: string]: boolean }>({});
  
  // State for Modals
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedJobToDeposit, setSelectedJobToDeposit] = useState<{ jobId: number; priceAVAX: string } | null>(null);
  const [infoModalJob, setInfoModalJob] = useState<Job | null>(null);

  const fetchMyPostedJobs = useCallback(async () => {
    if (!provider || !account || !contract) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const jobsExtraData = JSON.parse(localStorage.getItem('jobsExtraData') || '{}');
      const jobPromises: Promise<Job | null>[] = [];

      for (let i = 0; i < nextJobId; i++) {
        jobPromises.push((async (): Promise<Job | null> => {
          const jobData = await contract.jobs(i);
          if (jobData.client.toLowerCase() !== account.toLowerCase()) {
            return null;
          }

          let extraData = jobsExtraData[i.toString()];

          if (!extraData) {
            // This logic can be simplified or improved based on actual event indexing capabilities
            // console.log(`Fetching extra data for Job ID ${i} from blockchain events...`); // Removed
            // This is an example and might be slow. For production, use an indexed backend (subgraph).
            const jobPostedFilter = contract.filters.JobPosted(i, account);
            const events = await contract.queryFilter(jobPostedFilter, 0, 'latest');
            if (events.length > 0) {
                const latestEvent = events[events.length - 1];
                const block = await latestEvent.getBlock();
                extraData = {
                    txHash: latestEvent.transactionHash,
                    postDate: block ? new Date(Number(block.timestamp) * 1000).toLocaleDateString() : 'N/A',
                };
                jobsExtraData[i.toString()] = extraData;
                localStorage.setItem('jobsExtraData', JSON.stringify(jobsExtraData));
            }
          }

          const bids = await contract.getBidsForJob(i);
          // Process bids to convert BigInts to Numbers and standardize addresses, and explicitly select properties
          const processedBids = bids.map((bid: any) => ({
              bidId: Number(bid.bidId), // Convert BigInt to Number
              jobId: Number(bid.jobId), // Convert BigInt to Number
              freelancer: String(bid.freelancer).toLowerCase(), // Explicitly convert to lowercase string
              proposalText: String(bid.proposalText), // Explicitly get proposalText as string
          }));
          const description = await getFileContentFromIPFS(jobData.descriptionIPFSHash) || 'Description not found.';

          return {
            jobId: i,
            client: String(jobData.client).toLowerCase(), // Standardize client address
            freelancer: String(jobData.freelancer).toLowerCase(), // Standardize assigned freelancer address
            title: jobData.title,
            description,
            price: ethers.formatEther(jobData.price),
            deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
            postDate: extraData?.postDate || 'N/A',
            txHash: extraData?.txHash || '#',
            status: Number(jobData.status),
            bidCount: processedBids.length,
            bids: processedBids, // Store the processed bids
            disputeReason: jobData.disputeReason,
          };

        })());
      }

      const resolvedJobs = (await Promise.all(jobPromises)).filter((job): job is Job => job !== null);
      setJobs(resolvedJobs.reverse());
    } catch (err: any) {
      console.error('Error fetching posted jobs:', err);
      setError(err.reason || err.message || 'Failed to fetch posted jobs.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract]);

  useEffect(() => {
    fetchMyPostedJobs();
  }, [fetchMyPostedJobs, refreshTrigger]);

  const handleRaiseDisputeClick = (jobId: number) => {
    onRaiseDispute(jobId);
  };
  
  const handleViewFreelancer = (job: Job) => {
    setInfoModalJob(job);
  };

  const handleReleaseFunds = async (jobId: number) => {
    if (!contract) return;
    const actionKey = `release-${jobId}`;
    setActionState(prev => ({ ...prev, [actionKey]: true }));
    try {
        const tx = await contract.clientReleaseFunds(jobId);
        await tx.wait();
        toast.success("Funds released successfully!");
        fetchMyPostedJobs();
    } catch (error: any) {
        console.error("Failed to release funds:", error);
        toast.error("Failed to release funds.", { description: error.reason || error.message });
    } finally {
        setActionState(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenDepositModal = (jobId: number, priceAVAX: string) => {
    setSelectedJobToDeposit({ jobId, priceAVAX });
    setIsDepositModalOpen(true);
  };

  const handleDepositSuccess = () => {
    fetchMyPostedJobs(); // Refresh list after successful deposit
  };

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (jobs.length === 0) return <p className="p-4 text-center text-muted-foreground">You haven't posted any jobs yet.</p>;

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard 
          key={job.jobId}
          job={job}
          onReleaseFunds={handleReleaseFunds}
          handleRaiseDisputeClick={handleRaiseDisputeClick}
          onViewBids={onViewBids}
          onOpenDepositModal={handleOpenDepositModal}
          onViewFreelancer={handleViewFreelancer}
          actionState={actionState}
        />
      ))}

      {selectedJobToDeposit && (
        <DepositModal 
          jobId={selectedJobToDeposit.jobId}
          priceAVAX={selectedJobToDeposit.priceAVAX}
          open={isDepositModalOpen}
          onOpenChange={setIsDepositModalOpen}
          onDepositSuccess={handleDepositSuccess}
        />
      )}

      <FreelancerInfoModal
        job={infoModalJob}
        open={!!infoModalJob}
        onOpenChange={() => setInfoModalJob(null)}
      />
    </div>
  );
};

export default MyPostedJobs;
