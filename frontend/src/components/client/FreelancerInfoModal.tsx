import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ethers } from 'ethers';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

// This interface should match or be compatible with the Job interface in MyPostedJobs.tsx
interface Job {
  jobId: number;
  freelancer: string;
  title: string;
  bids: any[];
  // Add other properties as needed for display
}

interface Profile {
  skills: string[];
  experience: string;
}

interface FreelancerInfoModalProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FreelancerInfoModal: React.FC<FreelancerInfoModalProps> = ({ job, open, onOpenChange }) => {
  const [freelancerProfile, setFreelancerProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (open && job && job.freelancer && job.freelancer !== ethers.ZeroAddress) {
      setLoadingProfile(true);
      const fetchProfile = async () => {
        try {
          const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/freelancer-profile/${job.freelancer}`;
          const response = await axios.get(apiUrl);
          setFreelancerProfile(response.data);
        } catch (error) {
          console.error("Failed to fetch freelancer profile:", error);
          setFreelancerProfile(null);
        } finally {
          setLoadingProfile(false);
        }
      };
      fetchProfile();
    } else if (!open) {
      // Reset profile data when modal closes
      setFreelancerProfile(null);
      setLoadingProfile(true); // Reset loading state too
    }
  }, [open, job]);

  if (!job) {
    return null;
  }

  // Find the winning bid by matching the assigned freelancer's address, with robust checks
  const winningBid = job.bids.find(bid => bid && bid.freelancer && job.freelancer && String(bid.freelancer).toLowerCase() === String(job.freelancer).toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Freelancer & Bid Details</DialogTitle>
          <DialogDescription>
            Information for the assigned freelancer on job: "{job.title}"
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Assigned Freelancer</h4>
            <p className="text-sm text-muted-foreground break-all">{job.freelancer}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold">Winning Proposal</h4>
            {winningBid ? (
              <p className="text-sm text-muted-foreground italic">"{winningBid.proposalText}"</p>
            ) : (
              <p className="text-sm text-muted-foreground">Could not find the original proposal for this freelancer.</p>
            )}
          </div>
          
          <Separator />

           <div className="space-y-2">
            <h4 className="font-semibold">Freelancer Profile</h4>
            {loadingProfile ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching profile...
              </div>
            ) : freelancerProfile ? (
              <div className="p-4 bg-secondary rounded-md space-y-2">
                <div>
                  <p className="font-medium text-sm">Skills:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {freelancerProfile.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">Experience:</p>
                  <p className="text-sm text-muted-foreground">{freelancerProfile.experience}</p>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Could not load freelancer profile.</AlertDescription>
              </Alert>
            )}
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FreelancerInfoModal;
