import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../../contexts/Web3Context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Bid {
    bidId: number;
    freelancer: string;
    proposalText: string;
}

const ViewBidsPage: React.FC = () => {
    const { jobId: jobIdParam } = useParams<{ jobId: string }>();
    const jobId = jobIdParam ? parseInt(jobIdParam, 10) : null;
    const navigate = useNavigate();
    
    const { provider, contract } = useWeb3();
    const [bids, setBids] = useState<Bid[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionState, setActionState] = useState<{ [key: number]: boolean }>({});

    const fetchBidsForJob = useCallback(async () => {
        if (!provider || !contract || jobId === null) return;

        setLoading(true);
        setError(null);
        try {
            const allBidsData = await contract.getBidsForJob(jobId);
            const formattedBids: Bid[] = allBidsData.map((bid: any, index: number) => ({
                bidId: index,
                freelancer: bid.freelancer,
                proposalText: bid.proposalText,
            }));
            setBids(formattedBids);
        } catch (err: any) {
            console.error('Error fetching bids:', err);
            setError(err.reason || err.message || 'Failed to fetch bids for this job.');
        } finally {
            setLoading(false);
        }
    }, [provider, contract, jobId]);

    useEffect(() => {
        fetchBidsForJob();
    }, [fetchBidsForJob]);

    const handleAcceptBid = async (bidId: number) => {
        if (!contract || jobId === null) return;

        setActionState(prev => ({ ...prev, [bidId]: true }));
        try {
            const tx = await contract.acceptBid(jobId, bidId);
            await tx.wait();
            navigate('/client-dashboard/my-jobs'); // Redirect after accepting
        } catch (error: any) {
            console.error("Failed to accept bid:", error);
            setError(error.reason || "Failed to accept bid. The transaction may have been reverted.");
        } finally {
            setActionState(prev => ({ ...prev, [bidId]: false }));
        }
    };

    if (loading) return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (error) return <Alert variant="destructive" className="m-4"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
    
    return (
        <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
                <Button onClick={() => navigate('/client-dashboard/bids')} variant="outline" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-bold">Bids for Job #{jobId}</h2>
            </div>
            
            {bids.length === 0 ? (
                <p className="text-center text-muted-foreground">No bids have been placed for this job yet.</p>
            ) : (
                <div className="space-y-4">
                    {bids.map((bid) => (
                        <Card key={bid.freelancer}>
                            <CardHeader>
                                <CardTitle>Bid from: {bid.freelancer.substring(0, 6)}...{bid.freelancer.substring(bid.freelancer.length - 4)}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground italic mb-4">"{bid.proposalText}"</p>
                                <Separator />
                                <div className="flex justify-end mt-4">
                                    <Button
                                        onClick={() => handleAcceptBid(bid.bidId)}
                                        disabled={actionState[bid.bidId]}
                                    >
                                        {actionState[bid.bidId] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Accept This Bid"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewBidsPage;