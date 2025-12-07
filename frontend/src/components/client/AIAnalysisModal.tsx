import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { Separator } from '@/components/ui/separator';

interface Bid {
    bidId: number;
    freelancer: string;
    proposalText: string;
}

interface JobWithBids {
  jobId: number;
  title: string;
  description: string; // This is the IPFS hash
  bids: Bid[];
}

interface AnalyzedBid extends Bid {
    match_score: number;
    reason: string;
}

interface AIAnalysisModalProps {
  job: JobWithBids | null; // Now accepts the full job object
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock data - In a real app, this would come from a user profile context or be retrieved
const MOCK_FREELANCER_PROFILE = {
    skills: ["React", "TypeScript", "Solidity", "Ethers.js", "Tailwind CSS"],
    experience: "5 years developing Web3 applications, specializing in DeFi and NFT marketplaces. Completed 15+ projects on Avalanche and Ethereum.",
};

const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ job, open, onOpenChange }) => {
  const [analyzedBids, setAnalyzedBids] = useState<AnalyzedBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && job) {
      const fetchAnalysis = async () => {
        setLoading(true);
        setError(null);
        setAnalyzedBids([]);
        
        try {
          const results: AnalyzedBid[] = [];
          for (const bid of job.bids) {
            const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/evaluate-job-fit`;
            const requestBody = {
              jobId: job.jobId,
              freelancerProfile: MOCK_FREELANCER_PROFILE,
              bidProposal: bid.proposalText, // Include bid proposal for more accurate analysis
            };
            
            // Temporary: Add a delay to each call to avoid overwhelming the LLM API
            await new Promise(resolve => setTimeout(resolve, 500));

            const response = await axios.post(apiUrl, requestBody);
            
            results.push({
              ...bid,
              match_score: response.data.match_score,
              reason: response.data.reason,
            });
          }
          
          // Sort bids by score (descending)
          results.sort((a, b) => b.match_score - a.match_score);
          setAnalyzedBids(results);

        } catch (err: any) {
          console.error("Failed to fetch AI analysis:", err);
          setError(err.response?.data?.detail?.reason || err.message || "Failed to fetch AI analysis.");
        } finally {
          setLoading(false);
        }
      };

      fetchAnalysis();
    }
  }, [open, job]);

  if (!job) return null; // Don't render if no job is provided

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-blue-500" />
            AI Bidder Analysis for Job #{job.jobId} - "{job.title}"
          </DialogTitle>
          <DialogDescription>
            Comparing freelancer profiles and proposals against job requirements.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Analyzing Bids with AI...</p>
            </div>
          )}
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {!loading && analyzedBids.length === 0 && !error && (
            <p className="text-center text-muted-foreground">No bids to analyze or analysis failed.</p>
          )}
          
          {analyzedBids.length > 0 && (
            <div className="space-y-4">
                {analyzedBids.map(bid => (
                    <Card key={bid.freelancer}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-md font-medium">Bidder: {bid.freelancer.substring(0, 6)}...{bid.freelancer.substring(bid.freelancer.length - 4)}</CardTitle>
                            <Badge className="text-base bg-blue-500 hover:bg-blue-600 text-white">Score: {bid.match_score}/10</Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="font-semibold text-sm">Proposal:</p>
                            <p className="text-sm text-muted-foreground italic mt-1">"{bid.proposalText}"</p>
                            <Separator className="my-3" />
                            <p className="font-semibold text-sm">AI Reason:</p>
                            <p className="text-sm text-muted-foreground">{bid.reason}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisModal;

