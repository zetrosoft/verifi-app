import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Users, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import AIAnalysisModal from './AIAnalysisModal';

interface Bid {
    bidId: number;
    freelancer: string;
    proposalText: string;
}

interface JobWithBids {
  jobId: number;
  title: string;
  description: string;
  bids: Bid[];
}

interface JobsWithBidsProps {
    jobId: number | null;
    onBidAccepted: () => void;
}

const JobsWithBids: React.FC<JobsWithBidsProps> = ({ jobId, onBidAccepted }) => {
  const { provider, account, contract } = useWeb3();
  const [job, setJob] = useState<JobWithBids | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ [key: string]: boolean }>({});
  
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  
  const fetchJobWithBids = useCallback(async () => {
    if (!provider || !account || !contract || jobId === null) {
        setError("No job selected.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    try {
        const jobData = await contract.jobs(jobId);
        if (jobData.client.toLowerCase() !== account.toLowerCase() || Number(jobData.status) !== 0) {
            throw new Error("Job not open for bidding or you are not the client.");
        }

        const bidsData = await contract.getBidsForJob(jobId);
        const formattedBids: Bid[] = bidsData.map((bid: any, index: number) => ({
            bidId: index,
            freelancer: bid.freelancer,
            proposalText: bid.proposalText,
        }));

        setJob({
            jobId: jobId,
            title: jobData.title,
            description: jobData.descriptionIPFSHash,
            bids: formattedBids,
        });

    } catch (err: any) {
      // console.error('Error fetching job with bids:', err); // Removed
      setError(err.reason || err.message || 'Failed to fetch job details.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract, jobId]);

  useEffect(() => {
    fetchJobWithBids();
  }, [fetchJobWithBids]);

  const handleAcceptBid = async (jobId: number, bidId: number) => {
    const actionKey = `accept-${jobId}-${bidId}`;
    setActionState(prev => ({ ...prev, [actionKey]: true }));
    try {
        const tx = await contract.acceptBid(jobId, bidId);
        await tx.wait();
        toast.success("Bid accepted successfully! Job status updated to 'Assigned'.");
        onBidAccepted(); // Call the callback to handle navigation and refresh
    } catch (error: any) {
        // console.error("Failed to accept bid:", error); // Removed
        toast.error("Failed to accept bid.", { description: error.reason || error.message });
    } finally {
        setActionState(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenAnalysis = () => {
    setIsAnalysisModalOpen(true);
  };

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (!job || job.bids.length === 0) return <p className="p-4 text-center text-muted-foreground">This job has no active bids.</p>;

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Review Bids</h2>
            <Card className="w-full">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{job.title}</CardTitle>
                    <CardDescription className="mt-1 truncate">
                      {`Job ID: ${job.jobId} | Description Hash: ${job.description.substring(0, 20)}...`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleOpenAnalysis}>
                          <BrainCircuit className="mr-2 h-4 w-4"/> View AI Analysis
                      </Button>
                      <Badge className="text-sm py-0.5 px-2">
                          <Users className="mr-1 h-3 w-3" />
                          {job.bids.length} Bid(s)
                      </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                  <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                      <AccordionItem value="item-1">
                          <AccordionTrigger>View Submitted Bids</AccordionTrigger>
                          <AccordionContent>
                              <div className="space-y-4 pt-4">
                                  {job.bids.map(bid => (
                                      <div key={bid.bidId} className="p-4 border rounded-lg flex justify-between items-center">
                                          <div>
                                              <p className="font-semibold text-sm">Bidder: {bid.freelancer}</p>
                                              <p className="text-sm text-muted-foreground mt-1">"{bid.proposalText}"</p>
                                          </div>
                                          <Button 
                                              size="sm"
                                              onClick={() => handleAcceptBid(job.jobId, bid.bidId)}
                                              disabled={actionState[`accept-${job.jobId}-${bid.bidId}`]}
                                          >
                                              {actionState[`accept-${job.jobId}-${bid.bidId}`] ? 
                                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                                                  : "Accept Bid"
                                              }
                                          </Button>
                                      </div>
                                  ))}
                              </div>
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
              </CardContent>
            </Card>
      </div>
      {job && (
        <AIAnalysisModal 
            job={job}
            open={isAnalysisModalOpen}
            onOpenChange={setIsAnalysisModalOpen}
        />
      )}
    </>
  );
};

export default JobsWithBids;