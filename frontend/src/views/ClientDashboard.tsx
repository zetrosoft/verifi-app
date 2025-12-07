import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { LayoutDashboard, FileText, Users, Briefcase, Gavel, Settings, LogOut, Search, Menu as MenuIcon, User, Banknote } from "lucide-react";
import CreateJobForm from "../components/CreateJobForm";
import MyPostedJobsComponent from "../components/client/MyPostedJobs";
import AnalyticsCard from "@/components/common/AnalyticsCard";
import EarningReportsCard from "@/components/common/EarningReportsCard";
import ProfileCard from "@/components/common/ProfileCard";
import DisputeForm from "../components/client/DisputeForm";
import JobsWithBids from "../components/client/JobsWithBids";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ethers, Contract } from "ethers"; // Import ethers for balance formatting

// Constants for USDC payment (Frontend side) - Duplicated from DepositModal, consider centralizing
const USDC_ADDRESS = "0x04A0DC7C7029C647E4279ACcc64D2906D3dB283C"; 
// Minimal ERC20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
];

type ClientView = "overview" | "myJobs" | "postJob" | "jobsWithBids" | "dispute" | "profile" | "settings";

const ClientDashboard: React.FC = () => {
  const [view, setView] = useState<ClientView>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { account, isConnected, connectWallet, disconnectWallet, isLoading, error: web3Error, contract, provider } = useWeb3();
  const [selectedJobIdForDispute, setSelectedJobIdForDispute] = useState<number | null>(null);
  const [selectedJobIdForBids, setSelectedJobIdForBids] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State for balances dropdown
  const [avaxBalance, setAvaxBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // To control fetching on dropdown open

  useEffect(() => {
    if (!isConnected) setView("overview");
  }, [isConnected]);

  // Fetch balances when account changes or dropdown opens
  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !account || !provider) {
        setAvaxBalance(null);
        setUsdcBalance(null);
        return;
      }
      setFetchingBalances(true);
      try {
        // Fetch AVAX balance
        const avaxWei = await provider.getBalance(account);
        setAvaxBalance(ethers.formatEther(avaxWei));

        // Fetch USDC balance
        const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const usdcDecimals = await usdcContract.decimals();
        const usdcUnits = await usdcContract.balanceOf(account);
        setUsdcBalance(ethers.formatUnits(usdcUnits, usdcDecimals));

      } catch (err) {
        // console.error("Failed to fetch balances:", err); // Removed
        setAvaxBalance("Error");
        setUsdcBalance("Error");
      } finally {
        setFetchingBalances(false);
      }
    };

    if (isConnected && account && isDropdownOpen) { // Only fetch if connected and dropdown is open
      fetchBalances();
    } else if (!isDropdownOpen) {
      // Clear balances when dropdown closes
      setAvaxBalance(null);
      setUsdcBalance(null);
    }
  }, [isConnected, account, provider, isDropdownOpen]);

  const handleJobPosted = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setView("myJobs");
  }, []);

  const handleViewBids = useCallback((jobId: number) => {
    setSelectedJobIdForBids(jobId);
    setView("jobsWithBids");
  }, []);

  const handleRaiseDispute = useCallback((jobId: number) => { 
    setSelectedJobIdForDispute(jobId); 
    setView("dispute"); 
  }, []);

  const handleDisputeRaised = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setView("myJobs");
  }, []);

  const handleBidAccepted = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setView("myJobs");
  }, []);

  const navigationItems = [
    { text: "Dashboard", icon: LayoutDashboard, view: "overview" },
    { text: "My Jobs", icon: Briefcase, view: "myJobs" },
    { text: "My Jobs Bids", icon: Users, view: "jobsWithBids" },
    { text: "Post a Job", icon: FileText, view: "postJob" },
    { text: "Disputes", icon: Gavel, view: "dispute" },
  ];

  const secondaryNavigationItems = [
    { text: "Profile", icon: User, view: "profile" },
    { text: "Settings", icon: Settings, view: "settings" },
    { text: "Log Out", icon: LogOut, view: "logout" },
  ];

  const renderMainNavButtons = () => (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navigationItems.map((item) => (
        <Button
          key={item.text}
          variant={view === item.view ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => { setView(item.view as ClientView); setMobileMenuOpen(false); }}
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.text}
        </Button>
      ))}
    </nav>
  );

  const renderSecondaryNavButtons = () => (
    <nav className="grid items-start text-sm font-medium">
      {secondaryNavigationItems.map((item) => (
        <Button
          key={item.text}
          variant={view === item.view ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => {
            if (item.view === "logout") disconnectWallet();
            else setView(item.view as ClientView);
            setMobileMenuOpen(false);
          }}
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.text}
        </Button>
      ))}
    </nav>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="">VeriFi</span>
            </Link>
          </div>
          <div className="flex-1">{renderMainNavButtons()}</div>
          <div className="mt-auto p-4 border-t">{renderSecondaryNavButtons()}</div>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              {renderMainNavButtons()}
              <div className="mt-auto p-4 border-t">{renderSecondaryNavButtons()}</div>
            </SheetContent>
          </Sheet>

          <div className="w-full flex-1">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search..." className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3" />
              </div>
            </form>
          </div>
          {!isConnected ? (
              <Button onClick={connectWallet} disabled={isLoading}>Connect Wallet</Button>
            ) : (
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-24 justify-end text-sm font-normal">
                    <span className="truncate">{account?.substring(0, 6)}...{account?.substring(account.length - 4)}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Wallet Address</p>
                      <p className="text-xs leading-none text-muted-foreground break-all">
                        {account}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <div className="flex flex-col w-full">
                      <p className="flex items-center text-sm font-medium">
                        <Banknote className="mr-2 h-4 w-4" /> AVAX Balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fetchingBalances ? 'Loading...' : avaxBalance !== null ? `${parseFloat(avaxBalance).toFixed(4)} AVAX` : 'N/A'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex flex-col w-full">
                      <p className="flex items-center text-sm font-medium">
                        <Banknote className="mr-2 h-4 w-4" /> USDC Balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fetchingBalances ? 'Loading...' : usdcBalance !== null ? `${parseFloat(usdcBalance).toFixed(2)} USDC` : 'N/A'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ModeToggle />
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/150?img=68" alt="John Doe" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
           {!isConnected ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <h2 className="text-3xl font-bold">Welcome to Client Dashboard</h2>
              <p className="text-muted-foreground">Connect your Web3 wallet to post jobs and manage projects.</p>
              <Button onClick={connectWallet} disabled={isLoading} className="mt-4">
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </Button>
              {web3Error && <p className="text-destructive mt-2">{web3Error}</p>}
            </div>
          ) : (
            <>
              {view === "overview" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-1 min-h-[200px]"><AnalyticsCard className="w-full h-full" performance={0} respondRate={0} orderCompletion={0} /></div>
                  <div className="lg:col-span-1 min-h-[200px]"><EarningReportsCard className="w-full h-full" income={0} changePercentage={0} /></div>
                  <div className="lg:col-span-1"><ProfileCard name="Client Name" location="Client Location" avatarSrc="https://i.pravatar.cc/150?img=68" onEditProfile={() => {}} /></div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>My Posted Jobs</CardTitle>
                        <Button onClick={() => setView("postJob")}>Add New Project</Button>
                      </CardHeader>
                      <CardContent>
                        <MyPostedJobsComponent onViewBids={handleViewBids} onRaiseDispute={handleRaiseDispute} refreshTrigger={refreshTrigger} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              {view === "postJob" && <CreateJobForm onJobPosted={handleJobPosted} />}
              {view === "myJobs" && <MyPostedJobsComponent onViewBids={handleViewBids} onRaiseDispute={handleRaiseDispute} refreshTrigger={refreshTrigger} />}
              {view === "jobsWithBids" && <JobsWithBids jobId={selectedJobIdForBids} onBidAccepted={handleBidAccepted} />}
              {view === "dispute" && selectedJobIdForDispute && <DisputeForm jobId={selectedJobIdForDispute} onDisputeRaised={handleDisputeRaised} onCancel={() => setView("myJobs")} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ClientDashboard;
