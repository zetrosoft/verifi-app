import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { getFileContentFromIPFS } from '../../services/IPFSService';

interface BidOnJob {
  jobId: number;
  title: string;
  description: string;
  price: string;
  status: number;
  myProposal: string;
}

const MyBidsListComponent: React.FC = () => {
  const { provider, account, contract } = useWeb3();
  const [bidJobs, setBidJobs] = useState<BidOnJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStatusLabel = (status: number) => {
    const statuses = [
      'Open', 'Assigned', 'Funds Deposited', 'Work Submitted', 
      'Verified', 'Disputed', 'Completed', 'Cancelled'
    ];
    return statuses[status] || 'Unknown';
  };

  const fetchMyBids = useCallback(async () => {
    if (!provider || !account || !contract) {
      setBidJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const jobPromises: Promise<BidOnJob | null>[] = [];

      for (let i = 0; i < nextJobId; i++) {
        jobPromises.push((async (): Promise<BidOnJob | null> => {
          const bids = await contract.getBidsForJob(i);
          const myBid = bids.find((bid: any) => bid.freelancer.toLowerCase() === account.toLowerCase());

          if (myBid) {
            const jobData = await contract.jobs(i);
            const description = await getFileContentFromIPFS(jobData.descriptionIPFSHash) || 'Description not available.';
            
            return {
              jobId: i,
              title: jobData.title,
              description: description.substring(0, 150) + (description.length > 150 ? '...' : ''),
              price: ethers.formatEther(jobData.price),
              status: Number(jobData.status),
              myProposal: myBid.proposalText,
            };
          }
          return null;
        })());
      }
      
      const resolvedJobs = (await Promise.all(jobPromises)).filter((job): job is BidOnJob => job !== null);
      setBidJobs(resolvedJobs.reverse());
    } catch (err: any) {
      console.error('Error fetching my bids:', err);
      setError(err.reason || err.message || 'Failed to fetch bids.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract]);

  useEffect(() => {
    fetchMyBids();
  }, [fetchMyBids]);

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (bidJobs.length === 0) return <p className="p-4 text-center text-muted-foreground">You haven't placed any bids yet.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Bids</h2>
      {bidJobs.map((job) => (
        <Card key={job.jobId}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{job.title}</span>
              <Badge>{getStatusLabel(job.status)}</Badge>
            </CardTitle>
            <CardDescription>
              {job.price} AVAX
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
            <Alert>
              <AlertTitle>Your Proposal</AlertTitle>
              <AlertDescription>"{job.myProposal}"</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MyBidsListComponent;