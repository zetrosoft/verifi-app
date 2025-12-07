import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface JobHistoryItem {
  jobId: number;
  title: string;
  price: string;
  status: number;
  client: string;
}

const JobHistoryComponent: React.FC = () => {
  const { provider, account, contract } = useWeb3();
  const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStatusInfo = (status: number) => {
    if (status === 6) return { label: 'Completed', variant: 'success' };
    if (status === 7) return { label: 'Cancelled', variant: 'destructive' };
    return { label: 'Unknown', variant: 'default' };
  };

  const fetchJobHistory = useCallback(async () => {
    if (!provider || !account || !contract) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const jobPromises: Promise<JobHistoryItem | null>[] = [];

      const historyStatuses = [6, 7]; // Completed, Cancelled

      for (let i = 0; i < nextJobId; i++) {
        jobPromises.push((async (): Promise<JobHistoryItem | null> => {
          const jobData = await contract.jobs(i);
          if (
            jobData.freelancer.toLowerCase() === account.toLowerCase() &&
            historyStatuses.includes(Number(jobData.status))
          ) {
            return {
              jobId: i,
              title: jobData.title,
              price: ethers.formatEther(jobData.price),
              status: Number(jobData.status),
              client: jobData.client,
            };
          }
          return null;
        })());
      }
      
      const resolvedJobs = (await Promise.all(jobPromises)).filter((job): job is JobHistoryItem => job !== null);
      setJobs(resolvedJobs.reverse());
    } catch (err: any) {
      console.error('Error fetching job history:', err);
      setError(err.reason || err.message || 'Failed to fetch job history.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract]);

  useEffect(() => {
    fetchJobHistory();
  }, [fetchJobHistory]);

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (jobs.length === 0) return <p className="p-4 text-center text-muted-foreground">You have no completed or cancelled jobs.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Job History</h2>
      {jobs.map((job) => {
          const statusInfo = getStatusInfo(job.status);
          return (
            <Card key={job.jobId}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{job.title}</span>
                  <Badge variant={statusInfo.variant as any}>{statusInfo.label}</Badge>
                </CardTitle>
                <CardDescription>
                  {job.price} AVAX | Client: {job.client.substring(0, 6)}...{job.client.substring(job.client.length - 4)}
                </CardDescription>
              </CardHeader>
            </Card>
          )
        })}
    </div>
  );
};

export default JobHistoryComponent;
