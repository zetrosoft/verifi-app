import React, { useState } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from "sonner"; // Assuming sonner is installed

interface DisputeFormProps {
  jobId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisputeRaised: () => void;
}

const DisputeForm: React.FC<DisputeFormProps> = ({ jobId, open, onOpenChange, onDisputeRaised }) => {
  const { contract, isConnected } = useWeb3();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitDispute = async () => {
    if (!isConnected || !contract || !reason.trim()) {
      setError("Please connect your wallet and provide a reason for the dispute.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const tx = await contract.raiseDispute(jobId, reason);
      await tx.wait();
      toast.success("Dispute raised successfully! AI Agent will review.");
      onDisputeRaised(); // Callback to refresh job list in parent
      onOpenChange(false); // Close modal
      setReason(''); // Clear form
    } catch (err: any) {
      console.error("Error raising dispute:", err); // Keep error log for debugging
      const userMessage = err.reason || err.message || "Failed to raise dispute.";
      toast.error("Dispute Failed.", { description: userMessage });
      setError(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise Dispute for Job ID: {jobId}</DialogTitle>
          <DialogDescription>
            Explain why you want to dispute this job. The AI Agent will review.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Dispute Reason</Label>
            <Textarea
              id="reason"
              placeholder="Explain the issue in detail..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitDispute} disabled={isSubmitting || !reason.trim()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Raise Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DisputeForm;
