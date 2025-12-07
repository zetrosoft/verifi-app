import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWeb3 } from "../contexts/Web3Context";
import { uploadFileToIPFS } from "../services/IPFSService";
import axios from "axios";
import { ethers, Contract } from "ethers";
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner"; // Assuming sonner is installed

// Minimal ERC20 ABI for approve and transferFrom, balanceOf
const ERC20_ABI = [
    {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
];

interface JobPostResponse {
  jobId: number;
}

const CreateJobForm: React.FC = () => {
  const { contract, account, isConnected, isLoading, signer } = useWeb3();

  // Form state
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priceAVAX, setPriceAVAX] = useState<string>("0.01"); // Price in AVAX
  const [duration, setDuration] = useState<string>("1");
  const [durationUnit, setDurationUnit] = useState<"Minggu" | "Bulan">("Minggu");

  // AI Check state
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isFeasible, setIsFeasible] = useState<boolean | null>(null);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [priceRecommendation, setPriceRecommendation] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
  

  const checkFeasibility = useCallback(async () => {
    if (title.length < 10 || description.length < 50) {
      setIsFeasible(null);
      setAiMessage("Title or description is too short for analysis.");
      setPriceRecommendation("");
      return;
    }
    if (parseFloat(priceAVAX) <= 0) {
      setIsFeasible(false);
      setAiMessage("Price must be greater than zero.");
      setPriceRecommendation("");
      return;
    }
    if (parseInt(duration) <= 0) {
      setIsFeasible(false);
      setAiMessage("Duration must be greater than zero.");
      setPriceRecommendation("");
      return;
    }

    setIsChecking(true);
    setIsFeasible(null); // Reset previous feasibility status
    setAiMessage(""); // Clear previous AI message
    setPriceRecommendation(""); // Clear previous price recommendation
    try {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/check-job-feasibility`;
      const response = await axios.post(apiUrl, {
        title,
        description,
        price: parseFloat(priceAVAX),
        duration: parseInt(duration),
        duration_unit: durationUnit,
      });
      setIsFeasible(response.data.feasible);
      setAiMessage(response.data.reason);
      if (response.data.price_recommendation) {
        setPriceRecommendation(response.data.price_recommendation.recommendation_text);
      }
    } catch (error: any) {
      setIsFeasible(false);
      // console.error("Failed to analyze job feasibility:", error); // Removed
      setAiMessage(error.response?.data?.detail?.reason || "Failed to analyze job feasibility.");
    } finally {
      setIsChecking(false);
    }
  }, [title, description, priceAVAX, duration, durationUnit]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !contract || !account || !signer) {
      setNotification({ open: true, message: "Please connect your wallet.", severity: "error" });
      return;
    }
    if (isFeasible === false) {
      setNotification({ open: true, message: "Job cannot be posted due to AI feasibility check.", severity: "error" });
      return;
    }
    if (isFeasible === null) {
        setNotification({ open: true, message: "Please run AI feasibility check first.", severity: "error" });
        return;
    }

    setIsSubmitting(true);
    try {
      const ipfsHash = await uploadFileToIPFS(description, `job_description_${Date.now()}.txt`);
      if (!ipfsHash) {
        throw new Error("Failed to upload job description to IPFS.");
      }

      const deadlineInSeconds = parseInt(duration) * (durationUnit === "Minggu" ? 7 : 30) * 24 * 60 * 60;
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadlineInSeconds;

      const jobId = Number(await contract.getJobCount()); // Get next jobId for localStorage

      // Always post with AVAX price, payment method is chosen at deposit
      const tx = await contract.postJob(
        title,
        ipfsHash,
        ethers.parseEther(priceAVAX),
        deadlineTimestamp
      );
      const receipt = await tx.wait();

      const jobsExtraData = JSON.parse(localStorage.getItem('jobsExtraData') || '{}');
      jobsExtraData[jobId.toString()] = {
        txHash: receipt.hash,
        postDate: new Date().toLocaleDateString(),
      };
      localStorage.setItem('jobsExtraData', JSON.stringify(jobsExtraData));

      setNotification({ open: true, message: "Job posted successfully!", severity: "success" });
      
      // Reset form
      setTitle("");
      setDescription("");
      setPriceAVAX("0.01");
      setDuration("1");
      setDurationUnit("Minggu");
      setAiMessage("");
      setIsFeasible(null);
      setPriceRecommendation("");

    } catch (error: any) {
      // console.error("Error posting job:", error); // Removed
      let errorMessage = error.response?.data?.detail?.reason || error.message || "Failed to post job.";

      if (error.code === 'INSUFFICIENT_FUNDS') {
          errorMessage = "Insufficient AVAX funds in your wallet to cover the deposit and transaction fees. Please ensure you have enough AVAX.";
      }
      
      setNotification({ open: true, message: errorMessage, severity: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Post New Job</CardTitle>
        <CardDescription>Fill in your job details to post on the marketplace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              placeholder="e.g., Build a Landing Page with React"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Detailed Job Description</Label>
            <Textarea
              id="description"
              placeholder="Describe in detail what you need..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="priceAVAX">Price (AVAX)</Label>
              <Input
                id="priceAVAX"
                type="number"
                placeholder="0.01"
                value={priceAVAX}
                onChange={(e) => setPriceAVAX(e.target.value)}
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Job Duration</Label>
              <div className="flex gap-2">
                <Input
                  id="duration"
                  type="number"
                  placeholder="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  required
                  className="w-2/3"
                />
                <Select value={durationUnit} onValueChange={(value: "Minggu" | "Bulan") => setDurationUnit(value)}>
                  <SelectTrigger className="w-1/3">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Minggu">Week</SelectItem>
                    <SelectItem value="Bulan">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={checkFeasibility}
            disabled={isChecking || title.length < 10 || description.length < 50 || parseFloat(priceAVAX) <= 0 || parseInt(duration) <= 0}
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking Feasibility...
              </>
            ) : (
              "Run AI Feasibility Check"
            )}
          </Button>

          {aiMessage && (
            <Alert
              className={cn(
                "flex items-start gap-3", // Use items-start for better vertical alignment
                isFeasible === true && "border-green-500 text-green-700",
                isFeasible === false && "border-red-500 text-red-700",
                isFeasible === null && "border-blue-500 text-blue-700"
              )}
            >
              <div className="flex-shrink-0 mt-1">
                 {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFeasible === true ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isFeasible === false ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </div>
              <div className="flex-grow">
                <AlertTitle>AI Feasibility Check</AlertTitle>
                <AlertDescription>
                  <div>{aiMessage}</div>
                  {priceRecommendation && !isChecking && (
                      <div className="font-semibold text-blue-600 mt-2">
                          {priceRecommendation}
                      </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!isConnected || isSubmitting || isLoading || isFeasible === false || isFeasible === null}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting Job...
              </>
            ) : (
              "Post Job"
            )}
          </Button>
        </form>
      </CardContent>

      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert
            className={cn(
              notification.severity === "success" && "border-green-500 bg-green-50",
              notification.severity === "error" && "border-red-500 bg-red-50"
            )}
          >
            <AlertTitle>{notification.severity === "success" ? "Success!" : "Error!"}</AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
            <Button variant="ghost" onClick={handleCloseNotification} className="absolute top-2 right-2">
              X
            </Button>
          </Alert>
        </div>
      )}
    </Card>
  );
};

export default CreateJobForm;
