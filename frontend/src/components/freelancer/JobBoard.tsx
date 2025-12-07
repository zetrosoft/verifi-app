import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, BrainCircuit, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getFileContentFromIPFS } from '../../services/IPFSService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Interface untuk pekerjaan yang tersedia
interface AvailableJob {
  jobId: number;
  client: string;
  title: string;
  description: string;
  price: string;
  deadline: string;
  postDate: string;
  bids: any[]; // Add bids array to the interface
}

// Komponen untuk satu kartu pekerjaan
const JobCard: React.FC<{ job: AvailableJob; onBid: (jobId: number) => void; }> = ({ job, onBid }) => {
  
  const truncateTitle = (title: string, wordLimit: number) => {
    const words = title.split(' ');
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return title;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
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
          <Badge className="bg-green-500 text-white hover:bg-green-600">Open</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground h-12 overflow-hidden text-ellipsis">{job.description}</p>
        
        <Separator />
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span><strong>Price:</strong> {job.price} AVAX</span>
          <span><strong>Post Date:</strong> {job.postDate}</span>
          <span><strong>Deadline:</strong> {job.deadline}</span>
        </div>

        {/* Placeholder for AI Analysis */}
        <Alert className="border-blue-500/50">
            <BrainCircuit className="h-4 w-4" />
            <AlertTitle className="flex items-center">
                AI Match Analysis
                <Sparkles className="ml-2 h-4 w-4 text-blue-500" />
            </AlertTitle>
            <AlertDescription>
                Analisis kecocokan berdasarkan profil Anda akan muncul di sini. (Fitur dalam pengembangan)
            </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 mt-2">
            <Button variant="default" onClick={() => onBid(job.jobId)}>
                Submit Bid
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};


import JobDetailModal from './JobDetailModal'; // Import the modal

// ... (interfaces remain the same)

// Komponen utama JobBoard
const JobBoard: React.FC = () => {
  const { provider, contract, account } = useWeb3();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const fetchAvailableJobs = useCallback(async () => {
    // ... (fetch logic remains the same)
    if (!provider || !contract) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const jobsExtraData = JSON.parse(localStorage.getItem('jobsExtraData') || '{}');
      const jobPromises: Promise<AvailableJob | null>[] = [];

      for (let i = 0; i < nextJobId; i++) {
        jobPromises.push((async (): Promise<AvailableJob | null> => {
          const jobData = await contract.jobs(i);
          if (Number(jobData.status) !== 0) { // Status 0 is 'Open'
            return null;
          }

          // Fetch bids for the job
          const bids = await contract.getBidsForJob(i);

          const extraData = jobsExtraData[i] || {};
          const description = await getFileContentFromIPFS(jobData.descriptionIPFSHash) || 'Description not available.';
          
          return {
            jobId: i,
            client: jobData.client,
            title: jobData.title,
            description,
            price: ethers.formatEther(jobData.price),
            deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
            postDate: extraData.postDate || 'N/A', // Will be 'N/A' if not posted via new form
            bids: bids, // Store the fetched bids
          };
        })());
      }

      const resolvedJobs = (await Promise.all(jobPromises)).filter((job): job is AvailableJob => job !== null);
      setJobs(resolvedJobs.reverse());
    } catch (err: any) {
      console.error('Error fetching available jobs:', err);
      setError(err.reason || err.message || 'Failed to fetch jobs.');
    } finally {
      setLoading(false);
    }
  }, [provider, contract]);

  useEffect(() => {
    fetchAvailableJobs();
  }, [fetchAvailableJobs]);

  const handleOpenBidModal = (jobId: number) => {
    const job = jobs.find(j => j.jobId === jobId);
    if (job && account) {
      // Check if the current user has already bid
      const hasAlreadyBid = job.bids.some(bid => bid.freelancer.toLowerCase() === account.toLowerCase());
      if (hasAlreadyBid) {
        toast.info("You have already submitted a bid for this job.");
        return; // Stop execution and don't open the modal
      }
    }
    setSelectedJobId(jobId);
    setIsModalOpen(true);
  };
  
  const handleBidSubmitted = () => {
    toast.success("Bid submitted successfully! Redirecting...");
    // Refresh the job list to reflect any changes (e.g., if the job is removed from the board after a bid)
    fetchAvailableJobs(); 
    
    // Redirect to my bids page after a short delay to allow the user to see the toast
    setTimeout(() => {
        navigate('/freelancer-dashboard');
    }, 1500);
  };

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (jobs.length === 0) return <p className="p-4 text-center text-muted-foreground">No open jobs available at the moment.</p>;

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard 
            key={job.jobId}
            job={job}
            onBid={handleOpenBidModal}
          />
        ))}
      </div>
      <JobDetailModal
        jobId={selectedJobId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onBidSubmitted={handleBidSubmitted}
      />
    </>
  );
};


export default JobBoard;
