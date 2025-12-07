import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface JobDetailModalProps {
  jobId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBidSubmitted: () => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ jobId, open, onOpenChange, onBidSubmitted }) => {
  const { contract } = useWeb3();
  const [proposal, setProposal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset state when modal is closed or jobId changes
  useEffect(() => {
    if (!open) {
      setProposal('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmitBid = async () => {
    if (!contract || jobId === null || !proposal) {
      setError('Proposal text is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const tx = await contract.submitBid(jobId, proposal);
      await tx.wait();
      onBidSubmitted(); // Callback to refresh parent
      onOpenChange(false); // Close modal
    } catch (err: any) {
      console.error("Failed to submit bid:", err);
      setError(err.reason || err.message || "An error occurred while submitting the bid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Submit Bid for Job #{jobId}</DialogTitle>
          <DialogDescription>
            Write a compelling proposal to win this job.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="proposal">Your Proposal</Label>
            <Textarea 
                id="proposal"
                placeholder="Explain why you are the best fit for this job..." 
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                rows={5}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmitBid} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Bid'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobDetailModal;
