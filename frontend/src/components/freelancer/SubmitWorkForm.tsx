import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Info, GitFork, Image } from 'lucide-react'; // Added icons for repo/ipfs
import { toast } from "sonner";
import axios from "axios";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { uploadFileToIPFS } from '../../services/IPFSService'; // Assuming this is functional

interface SubmitWorkFormProps {
  jobId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkSubmitted: () => void;
}

interface AIInputTypeDecision {
  inputType: "ipfs_hash" | "repo_link";
  reason: string;
}

const SubmitWorkForm: React.FC<SubmitWorkFormProps> = ({ jobId, open, onOpenChange, onWorkSubmitted }) => {
  const { contract, account } = useWeb3();

  // State for AI-driven input type
  const [submissionType, setSubmissionType] = useState<"ipfs_hash" | "repo_link" | null>(null);
  const [submissionTypeReason, setSubmissionTypeReason] = useState<string>("");
  const [loadingSubmissionType, setLoadingSubmissionType] = useState(true);
  const [submissionTypeError, setSubmissionTypeError] = useState<string | null>(null);

  // State for form fields
  const [workLink, setWorkLink] = useState(''); // IPFS hash or Repo link (for repo_link type)
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // For ipfs_hash type
  const [isUploadingIPFS, setIsUploadingIPFS] = useState(false); // IPFS upload state
  const [ipfsUploadError, setIpfsUploadError] = useState<string | null>(null); // IPFS upload error
  const [workSummary, setWorkSummary] = useState('');
  const [testingInstructions, setTestingInstructions] = useState('');
  const [deploymentInstructions, setDeploymentInstructions] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const AI_AGENT_BASE_URL = import.meta.env.VITE_API_BASE_URL; // From .env

  // Fetch AI decision for input type when modal opens
  useEffect(() => {
    const fetchInputTypeDecision = async () => {
      if (!open || jobId === null || !AI_AGENT_BASE_URL) return;

      setLoadingSubmissionType(true);
      setSubmissionTypeError(null);
      try {
        const apiUrl = `${AI_AGENT_BASE_URL}/analyze-job-work-input/${jobId}`;
        const response = await axios.get<AIInputTypeDecision>(apiUrl);
        setSubmissionType(response.data.inputType);
        setSubmissionTypeReason(response.data.reason);
      } catch (err: any) {
        console.error("Failed to fetch AI input type decision:", err);
        setSubmissionTypeError(err.response?.data?.detail || err.message || "Failed to get AI decision for input type.");
      } finally {
        setLoadingSubmissionType(false);
      }
    };

    if (open) { // Reset state when modal opens
        setWorkLink('');
        setSelectedFile(null); // Reset selected file
        setIsUploadingIPFS(false); // Reset upload state
        setIpfsUploadError(null); // Reset upload error
        setWorkSummary('');
        setTestingInstructions('');
        setDeploymentInstructions('');
        setNotes('');
        setError(null);
        setSubmissionType(null); // Reset submission type
        setSubmissionTypeReason("");
        fetchInputTypeDecision();
    }
  }, [open, jobId, AI_AGENT_BASE_URL]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setIpfsUploadError(null); // Clear previous errors
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!contract || !account) {
      setError("Wallet not connected.");
      return;
    }
    if (loadingSubmissionType || submissionTypeError) {
      setError("AI is still determining the submission type, please wait or retry.");
      return;
    }
    // Validate based on submission type
    let finalWorkLink = workLink;
    if (submissionType === "ipfs_hash") {
      if (!selectedFile) {
        setError("Please select a file to upload for IPFS submission.");
        return;
      }
      setIsUploadingIPFS(true);
      setIpfsUploadError(null);
      try {
        const hash = await uploadFileToIPFS(selectedFile, selectedFile.name);
        if (!hash) {
          throw new Error("IPFS upload failed: returned null hash.");
        }
        finalWorkLink = hash;
      } catch (uploadErr: any) {
        setIpfsUploadError(`IPFS Upload Failed: ${uploadErr.message || "Unknown error."}`);
        setIsUploadingIPFS(false);
        return;
      } finally {
        setIsUploadingIPFS(false);
      }
    } else { // repo_link
      if (!workLink || !workLink.trim()) {
        setError("Repository link is required.");
        return;
      }
    }

    if (!workSummary.trim()) {
      setError('Work summary is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Combine all form data into a single object
      const submissionData = {
        jobId: jobId,
        freelancerAddress: account,
        submissionType: submissionType,
        workLink: finalWorkLink, // Use finalWorkLink here
        workSummary: workSummary.trim(),
        testingInstructions: testingInstructions.trim(),
        deploymentInstructions: deploymentInstructions.trim(),
        notes: notes.trim(),
        timestamp: Date.now(),
      };

      // 2. Upload the combined JSON data to IPFS
      const ipfsHashOfSubmissionData = await uploadFileToIPFS(JSON.stringify(submissionData), `job_${jobId}_work_submission.json`);
      if (!ipfsHashOfSubmissionData) {
        throw new Error("Failed to upload submission data to IPFS.");
      }

      // 3. Submit the IPFS hash of the JSON to the smart contract
      const tx = await contract.submitWork(jobId, ipfsHashOfSubmissionData);
      await tx.wait();
      toast.success("Work submitted successfully!");
      onWorkSubmitted(); // Callback to refresh the parent component
      onOpenChange(false); // Close the modal

    } catch (err: any) {
      console.error("Failed to submit work:", err);
      const userMessage = err.reason || err.message || "An error occurred.";
      toast.error("Work Submission Failed.", { description: userMessage });
      setError(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset all internal states
    setSubmissionType(null);
    setSubmissionTypeReason("");
    setLoadingSubmissionType(true);
    setSubmissionTypeError(null);
    setWorkLink('');
    setWorkSummary('');
    setTestingInstructions('');
    setDeploymentInstructions('');
    setNotes('');
    setError(null);
    setIsSubmitting(false);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Work for Job #{jobId}</DialogTitle>
          <DialogDescription>
            Provide details of your completed work for client review and AI verification.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {loadingSubmissionType ? (
            <div className="flex flex-col items-center justify-center gap-2 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">AI is analyzing job requirements for submission type...</p>
            </div>
          ) : submissionTypeError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{submissionTypeError}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Submission Type Info */}
              {submissionType && (
                <Alert className="border-blue-500/50">
                    <AlertTitle className="flex items-center">
                        <Info className="mr-2 h-4 w-4"/> Submission Type: {submissionType === "ipfs_hash" ? "IPFS Hash" : "Repository Link"}
                    </AlertTitle>
                    <AlertDescription>{submissionTypeReason}</AlertDescription>
                </Alert>
              )}

              {/* Work Link/Hash Input */}
              <div className="grid gap-2">
                {submissionType === "ipfs_hash" ? (
                  <>
                    <Label htmlFor="workFile">
                      <span className="flex items-center"><Image className="mr-2 h-4 w-4"/> Select File for IPFS Upload</span>
                    </Label>
                    <Input id="workFile" type="file" onChange={handleFileChange} className="col-span-3" />
                    {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>}
                    {ipfsUploadError && <Alert variant="destructive"><AlertDescription>{ipfsUploadError}</AlertDescription></Alert>}
                  </>
                ) : (
                  <>
                    <Label htmlFor="workLink">
                      <span className="flex items-center"><GitFork className="mr-2 h-4 w-4"/> Repository Link</span>
                    </Label>
                    <Input
                      id="workLink"
                      value={workLink}
                      onChange={(e) => setWorkLink(e.target.value)}
                      placeholder="e.g., https://github.com/user/repo"
                    />
                  </>
                )}
              </div>

              {/* Work Summary */}
              <div className="grid gap-2">
                <Label htmlFor="workSummary">Brief Summary of Work Done</Label>
                <Textarea
                  id="workSummary"
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="Summarize your completed work in a few sentences..."
                  rows={3}
                />
              </div>

              {/* Testing Instructions */}
              <div className="grid gap-2">
                <Label htmlFor="testingInstructions">Instructions for Testing/Verification (Optional)</Label>
                <Textarea
                  id="testingInstructions"
                  value={testingInstructions}
                  onChange={(e) => setTestingInstructions(e.target.value)}
                  placeholder="e.g., Run `npm test` or `Go to /tests`"
                  rows={3}
                />
              </div>

              {/* Deployment Instructions */}
              <div className="grid gap-2">
                <Label htmlFor="deploymentInstructions">Deployment/Usage Guide (Optional)</Label>
                <Textarea
                  id="deploymentInstructions"
                  value={deploymentInstructions}
                  onChange={(e) => setDeploymentInstructions(e.target.value)}
                  placeholder="e.g., Use `docker-compose up` or check the `README.md` file"
                  rows={3}
                />
              </div>

              {/* Notes/Challenges */}
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes or Challenges Faced (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific comments or challenges..."
                  rows={3}
                />
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isUploadingIPFS}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || loadingSubmissionType || submissionTypeError || isUploadingIPFS || (submissionType === "ipfs_hash" ? !selectedFile : !workLink) || !workSummary.trim()}>
            {isSubmitting || isUploadingIPFS ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingIPFS ? 'Uploading to IPFS...' : 'Submitting...'}</> : 'Submit Work'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitWorkForm;