import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Job {
  jobId: number;
  client: string;
  freelancer: string;
  title: string;
  descriptionIPFSHash: string;
  price: string;
  deadline: string;
  status: number;
  bidCount: number;
}

const JobBoardComponent: React.FC = () => {
  const { provider, account, contract, isConnected } = useWeb3();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingBid, setIsSubmittingBid] = useState<boolean>(false);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  const fetchOpenJobs = useCallback(async () => {
    if (!provider || !contract) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextJobId = Number(await contract.getJobCount());
      const fetchedJobs: Job[] = [];

      for (let i = 0; i < nextJobId; i++) {
        const jobData = await contract.jobs(i);
        // Only fetch jobs that are open (status 0) and not posted by the current account
        if (Number(jobData.status) === 0 && jobData.client.toLowerCase() !== account?.toLowerCase()) {
          const bids = await contract.getBidsForJob(i); // Assuming this function exists to get bid count
          fetchedJobs.push({
            jobId: i,
            client: jobData.client,
            freelancer: jobData.freelancer,
            title: jobData.title,
            descriptionIPFSHash: jobData.descriptionIPFSHash,
            price: ethers.formatEther(jobData.price),
            deadline: new Date(Number(jobData.deadline) * 1000).toLocaleDateString(),
            status: Number(jobData.status),
            bidCount: bids.length,
          });
        }
      }
      setJobs(fetchedJobs.reverse()); // Show newest first
    } catch (err: any) {
      console.error('Error fetching open jobs:', err);
      setError(err.reason || err.message || 'Failed to fetch open jobs.');
    } finally {
      setLoading(false);
    }
  }, [provider, account, contract]);

  useEffect(() => {
    fetchOpenJobs();
  }, [fetchOpenJobs]);

  const handleBidSubmit = async (jobId: number) => {
    if (!isConnected || !contract || !bidAmount || parseFloat(bidAmount) <= 0) {
      setNotification({ open: true, message: "Harap masukkan jumlah tawaran yang valid.", severity: "error" });
      return;
    }
    if (selectedJobId !== jobId) {
      // This prevents submitting bids for unintended jobs if the UI updates slowly
      return;
    }

    setIsSubmittingBid(true);
    try {
      const tx = await contract.submitBid(jobId, ethers.parseEther(bidAmount));
      await tx.wait();
      setNotification({ open: true, message: "Tawaran berhasil diajukan!", severity: "success" });
      setBidAmount(""); // Reset bid amount
      setSelectedJobId(null); // Reset selected job
      fetchOpenJobs(); // Refresh job list
    } catch (error: any) {
      console.error("Kesalahan saat mengajukan tawaran:", error);
      setNotification({ open: true, message: error.reason || error.message || "Gagal mengajukan tawaran.", severity: "error" });
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <h2 className="text-2xl font-bold">Connect your Web3 wallet to view jobs.</h2>
      <p className="text-muted-foreground">Please connect your wallet to browse available jobs.</p>
    </div>
  );

  if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (jobs.length === 0) return <p className="p-4 text-center text-muted-foreground">Tidak ada pekerjaan yang tersedia saat ini.</p>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Papan Pekerjaan</h2>
      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.jobId}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{job.title}</span>
                <Badge variant="default">Open</Badge>
              </CardTitle>
              <CardDescription>Job ID: {job.jobId}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <p className="text-sm"><strong>Client:</strong> {job.client.substring(0, 6)}...{job.client.substring(job.client.length - 4)}</p>
              <p className="text-sm"><strong>Harga:</strong> {job.price} AVAX</p>
              <p className="text-sm"><strong>Deadline:</strong> {job.deadline}</p>
              <p className="text-sm"><strong>Jumlah Tawaran:</strong> {job.bidCount}</p>
              <Button variant="link" onClick={() => console.log('View full description for job', job.jobId)}>Lihat Deskripsi Lengkap</Button>
              
              <Separator className="my-2" />

              {selectedJobId === job.jobId ? (
                <div className="flex flex-col gap-2">
                  <Input
                    type="number"
                    placeholder="Jumlah Tawaran (AVAX)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    step="0.01"
                    min="0.01"
                    required
                  />
                  <Button
                    onClick={() => handleBidSubmit(job.jobId)}
                    disabled={isSubmittingBid || parseFloat(bidAmount) <= 0}
                  >
                    {isSubmittingBid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ajukan Tawaran"}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedJobId(null)} disabled={isSubmittingBid}>Batal</Button>
                </div>
              ) : (
                <Button onClick={() => setSelectedJobId(job.jobId)} disabled={isSubmittingBid}>Ajukan Tawaran</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert
            className={notification.severity === "success" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}
          >
            <AlertTitle>{notification.severity === "success" ? "Sukses!" : "Error!"}</AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
            <Button variant="ghost" onClick={handleCloseNotification} className="absolute top-2 right-2">
              X
            </Button>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default JobBoardComponent;
