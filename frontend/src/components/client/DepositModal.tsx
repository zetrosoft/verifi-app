import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWeb3 } from '../../contexts/Web3Context';
import { ethers, Contract } from 'ethers';
import { Loader2, Info } from 'lucide-react';
import { toast } from "sonner";
import axios from "axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

// Constants for USDC payment (Frontend side)
const USDC_ADDRESS = "0x04A0DC7C7029C647E4279ACcc64D2906D3dB283C";
const AI_AGENT_ADDRESS = import.meta.env.VITE_AI_AGENT_ADDRESS; // Get AI Agent address from .env
const AVAX_USDC_CONVERSION_RATE = 10; // Mock rate: 1 AVAX = 10 USDC
const CLIENT_FEE_PERCENT = 2; // 2% fee from client, matches smart contract

// Minimal ERC20 ABI for approve and transfer, balanceOf, and decimals
const ERC20_ABI = [
    {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
];

interface DepositModalProps {
    jobId: number;
    priceAVAX: string; // The price of the job in AVAX (this is job.price from SC)
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDepositSuccess: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({ jobId, priceAVAX, open, onOpenChange, onDepositSuccess }) => {
    const { contract, account, signer, isConnected } = useWeb3();
    const [paymentMethod, setPaymentMethod] = useState<"AVAX" | "USDC">("AVAX");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usdcAmountExpected, setUsdcAmountExpected] = useState<string>("0.00");
    const [clientFeeAVAX, setClientFeeAVAX] = useState<string>("0.00");
    const [totalAVAXToDeposit, setTotalAVAXToDeposit] = useState<string>("0.00");
    const [totalAVAXInWeiString, setTotalAVAXInWeiString] = useState<string>("0"); // Store as string

    // Calculate fees and total amounts with high precision
    useEffect(() => {
        try {
            if (!priceAVAX || parseFloat(priceAVAX) <= 0) {
                throw new Error("Invalid price");
            }
            const basePriceWei = ethers.parseEther(priceAVAX);
            const feeWei = (basePriceWei * BigInt(CLIENT_FEE_PERCENT)) / BigInt(100);
            const totalWei = basePriceWei + feeWei;

            setTotalAVAXInWeiString(totalWei.toString()); // Store as string
            setTotalAVAXToDeposit(ethers.formatEther(totalWei)); // For display
            setClientFeeAVAX(ethers.formatEther(feeWei)); // For display
            
            const totalAVAXFloat = parseFloat(ethers.formatEther(totalWei));
            setUsdcAmountExpected((totalAVAXFloat * AVAX_USDC_CONVERSION_RATE).toFixed(2));
        } catch (e) {
            setTotalAVAXInWeiString("0");
            setTotalAVAXToDeposit("0.00");
            setClientFeeAVAX("0.00");
            setUsdcAmountExpected("0.00");
        }
    }, [priceAVAX]);

    const handleDepositAVAX = async () => {
        if (!contract || !signer || !account || !isConnected) {
            toast.error("Wallet not connected.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const tx = await contract.depositForJob(jobId, { value: BigInt(totalAVAXInWeiString) });
            await tx.wait();
            toast.success("AVAX deposited successfully!");
            onDepositSuccess();
            onOpenChange(false);
        } catch (err: any) {
            // console.error("Error depositing AVAX:", err); // Removed
            let userMessage = err.reason || err.message || "Failed to deposit AVAX.";
            if (err.code === 'CALL_EXCEPTION') {
                userMessage = "Transaction failed. Please ensure the job is in the 'Assigned' state and you have sufficient funds for the total deposit amount plus gas fees.";
            } else if (err.code === 'INSUFFICIENT_FUNDS') {
                userMessage = "Insufficient AVAX funds in your wallet to cover the deposit and transaction fees. Please ensure you have enough AVAX.";
            }
            toast.error("Deposit Failed.", { description: userMessage });
            setError(userMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDepositUSDC = async () => {
        if (!contract || !signer || !account || !AI_AGENT_ADDRESS || !isConnected) {
            toast.error("Wallet not connected or AI Agent address missing.");
            return;
        }
        if (parseFloat(usdcAmountExpected) <= 0) {
            toast.error("USDC amount must be greater than zero.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
            const usdcDecimals = await usdcContract.decimals();
            const amountToTransfer = ethers.parseUnits(usdcAmountExpected, usdcDecimals); // Use actual decimals

            // Check client's USDC balance
            const clientUSDCBalance = await usdcContract.balanceOf(account);
            if (clientUSDCBalance < amountToTransfer) {
                throw new Error("Insufficient USDC balance.");
            }

            // Transfer USDC directly to the AI Agent's address
            const tx = await usdcContract.transfer(AI_AGENT_ADDRESS, amountToTransfer);
            await tx.wait();
            toast.success("USDC transferred to AI Agent. Initiating swap & deposit...");

            // Notify AI Agent to perform swap and deposit AVAX
            const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/resolve-single-chain-payment`;
            const response = await axios.post(apiUrl, {
              jobId: jobId,
              clientAddress: account,
              tokenAddress: USDC_ADDRESS,
              amountToken: parseFloat(usdcAmountExpected), // Send as float for AI Agent
            });

            if (response.data.success) {
                toast.success("AI Agent successfully processed USDC payment and deposited AVAX!");
                onDepositSuccess();
                onOpenChange(false);
            } else {
                throw new Error(response.data.message || "AI Agent failed to process USDC payment.");
            }

        } catch (err: any) {
            // console.error("Error depositing USDC:", err); // Removed
            toast.error("Failed to deposit USDC.", { description: err.reason || err.message });
            setError(err.reason || err.message || "Failed to deposit USDC.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deposit Funds for Job #{jobId}</DialogTitle>
                    <DialogDescription>
                        Job Price: {priceAVAX} AVAX. Choose your preferred payment method.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={(value: "AVAX" | "USDC") => setPaymentMethod(value)} disabled={loading}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AVAX">AVAX</SelectItem>
                                <SelectItem value="USDC">USDC (Avalanche C-Chain)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {paymentMethod === "AVAX" && (
                        <div className="grid gap-2">
                            <Label className="flex items-center">
                                Amount to Deposit (AVAX)
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="ml-1 h-4 w-4 text-muted-foreground cursor-pointer" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This includes a {CLIENT_FEE_PERCENT}% client fee.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <Input value={totalAVAXToDeposit} readOnly />
                            <p className="text-sm text-muted-foreground">
                                Job Price: {priceAVAX} AVAX + {clientFeeAVAX} AVAX (Client Fee)
                            </p>
                        </div>
                    )}

                    {paymentMethod === "USDC" && (
                        <div className="grid gap-2">
                            <Label className="flex items-center">
                                Amount to Deposit (USDC)
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="ml-1 h-4 w-4 text-muted-foreground cursor-pointer" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This includes a {CLIENT_FEE_PERCENT}% client fee, converted from AVAX to USDC.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <Input value={usdcAmountExpected} readOnly />
                            <p className="text-sm text-muted-foreground">
                                Equivalent to {totalAVAXToDeposit} AVAX (Job Price + Client Fee).
                            </p>
                            {!AI_AGENT_ADDRESS && (
                                <p className="text-red-500 text-sm">Error: VITE_AI_AGENT_ADDRESS is not set in your .env file.</p>
                            )}
                        </div>
                    )}

                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={paymentMethod === "AVAX" ? handleDepositAVAX : handleDepositUSDC} 
                        disabled={loading || !isConnected || (paymentMethod === "USDC" && !AI_AGENT_ADDRESS)}
                    >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Confirm Deposit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DepositModal;