"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// Admin address (clawfred.eth)
const ADMIN = "0x1ddd084e09f4fae7f6b872d0481830bee99b1dfe";

// Format FRED amounts with commas for readability
const formatFredAmount = (amount: bigint): string => {
  return Number(formatEther(amount)).toLocaleString();
};

interface Idea {
  id: bigint;
  creator: string;
  content: string;
  totalStaked: bigint;
  stakerCount: bigint;
  isBuilt: boolean;
  isBurned: boolean;
  payoutPool: bigint;
  createdAt: bigint;
}

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const isAdmin = connectedAddress?.toLowerCase() === ADMIN.toLowerCase();

  // Get deployed FredLabs contract address
  const { data: fredLabsInfo } = useDeployedContractInfo("FredLabs");
  const fredLabsAddress = fredLabsInfo?.address;

  // Read costs from contract (never hardcode!)
  const { data: submitCost } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "SUBMIT_COST",
  });

  const { data: stakeCost } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "STAKE_COST",
  });

  // State
  const [ideaContent, setIdeaContent] = useState("");
  const [payoutAmounts, setPayoutAmounts] = useState<Record<number, string>>({});

  // Warning banner dismissed state (localStorage)
  const [warningDismissed, setWarningDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem("fred-labs-warning-dismissed");
    setWarningDismissed(dismissed === "true");
  }, []);

  const dismissWarning = () => {
    localStorage.setItem("fred-labs-warning-dismissed", "true");
    setWarningDismissed(true);
  };

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApprovingSubmit, setIsApprovingSubmit] = useState(false);
  const [stakingIdeaId, setStakingIdeaId] = useState<number | null>(null);
  const [approvingStakeIdeaId, setApprovingStakeIdeaId] = useState<number | null>(null);
  const [markingBuiltId, setMarkingBuiltId] = useState<number | null>(null);
  const [burningId, setBurningId] = useState<number | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Read total ideas
  const { data: totalIdeas, refetch: refetchTotalIdeas } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "getTotalIdeas",
  });

  // Read FRED balance
  const { data: fredBalance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "FRED",
    functionName: "balanceOf",
    args: [connectedAddress],
    query: { enabled: !!connectedAddress },
  });

  // Read allowance
  const { data: submitAllowance, refetch: refetchSubmitAllowance } = useScaffoldReadContract({
    contractName: "FRED",
    functionName: "allowance",
    args: [connectedAddress, fredLabsAddress],
    query: { enabled: !!connectedAddress && !!fredLabsAddress },
  });

  const hasSubmitAllowance = submitAllowance && submitCost && submitAllowance >= submitCost;
  const hasStakeAllowance = submitAllowance && stakeCost && submitAllowance >= stakeCost;

  // Contract writes
  const { writeContractAsync: writeFredLabs, isMining: isFredLabsMining } = useScaffoldWriteContract({
    contractName: "FredLabs",
  });
  const { writeContractAsync: writeFRED, isMining: isFREDMining } = useScaffoldWriteContract({
    contractName: "FRED",
  });

  const isAnyMining = isFredLabsMining || isFREDMining;

  // Approve FRED for submit
  const handleApproveForSubmit = async () => {
    if (!connectedAddress || !fredLabsAddress || !submitCost) return;
    setIsApprovingSubmit(true);
    try {
      await writeFRED({
        functionName: "approve",
        args: [fredLabsAddress, submitCost],
      });
      notification.success("Approved FRED for submission!");
      refetchSubmitAllowance();
    } catch (e) {
      console.error(e);
      notification.error("Approval failed");
    } finally {
      setIsApprovingSubmit(false);
    }
  };

  // Approve FRED for stake
  const handleApproveForStake = async (ideaId: number) => {
    if (!connectedAddress || !fredLabsAddress || !stakeCost) return;
    setApprovingStakeIdeaId(ideaId);
    try {
      await writeFRED({
        functionName: "approve",
        args: [fredLabsAddress, stakeCost],
      });
      notification.success("Approved FRED for staking!");
      refetchSubmitAllowance();
    } catch (e) {
      console.error(e);
      notification.error("Approval failed");
    } finally {
      setApprovingStakeIdeaId(null);
    }
  };

  // Submit idea
  const handleSubmitIdea = async () => {
    if (!ideaContent.trim()) {
      notification.error("Please enter an idea");
      return;
    }
    setIsSubmitting(true);
    try {
      await writeFredLabs({
        functionName: "submitIdea",
        args: [ideaContent],
      });
      notification.success("Idea submitted!");
      setIdeaContent("");
      refetchTotalIdeas();
      refetchBalance();
      refetchSubmitAllowance();
    } catch (e) {
      console.error(e);
      notification.error("Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stake on idea
  const handleStake = async (ideaId: number) => {
    setStakingIdeaId(ideaId);
    try {
      await writeFredLabs({
        functionName: "stakeOnIdea",
        args: [BigInt(ideaId)],
      });
      notification.success("Stake placed!");
      refetchTotalIdeas();
      refetchBalance();
      refetchSubmitAllowance();
    } catch (e) {
      console.error(e);
      notification.error("Stake failed");
    } finally {
      setStakingIdeaId(null);
    }
  };

  // Mark as built (admin)
  const handleMarkBuilt = async (ideaId: number) => {
    const payoutStr = payoutAmounts[ideaId] || "0";
    const payout = parseEther(payoutStr || "0");
    setMarkingBuiltId(ideaId);
    try {
      await writeFredLabs({
        functionName: "markBuilt",
        args: [BigInt(ideaId), payout],
      });
      notification.success("Marked as built!");
      refetchTotalIdeas();
    } catch (e) {
      console.error(e);
      notification.error("Mark built failed");
    } finally {
      setMarkingBuiltId(null);
    }
  };

  // Burn idea (admin)
  const handleBurn = async (ideaId: number) => {
    setBurningId(ideaId);
    try {
      await writeFredLabs({
        functionName: "burnIdea",
        args: [BigInt(ideaId)],
      });
      notification.success("Idea rejected!");
      refetchTotalIdeas();
    } catch (e) {
      console.error(e);
      notification.error("Burn failed");
    } finally {
      setBurningId(null);
    }
  };

  // Claim payout
  const handleClaim = async (ideaId: number) => {
    setClaimingId(ideaId);
    try {
      await writeFredLabs({
        functionName: "claimPayout",
        args: [BigInt(ideaId)],
      });
      notification.success("Payout claimed!");
      refetchTotalIdeas();
      refetchBalance();
    } catch (e) {
      console.error(e);
      notification.error("Claim failed");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center pb-16">
        {/* Warning Banner */}
        {!warningDismissed && (
          <div className="w-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/30 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4 max-w-4xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-200 mb-1">Important Notice</p>
                  <p className="text-sm text-white/70">
                    Offensive or inappropriate content will have its staked FRED{" "}
                    <span className="text-red-400 font-semibold">burned</span>. This is experimental software — use at your own risk.
                  </p>
                  <button
                    className="mt-3 px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-200 text-sm font-medium transition-all"
                    onClick={dismissWarning}
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-4xl shadow-2xl shadow-purple-500/30">
                  🤖
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <span className="text-xs">✓</span>
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                FredLabs
              </span>
            </h1>
            <p className="text-lg text-white/60 max-w-md mx-auto">
              Submit ideas, stake on favorites, and earn rewards when they get built
            </p>
          </div>

          {/* Balance Card */}
          {connectedAddress && fredBalance !== undefined && (
            <div className="mb-8 p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white">
                    $
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Your Balance</p>
                    <p className="text-2xl font-bold text-white">
                      {formatFredAmount(fredBalance)} <span className="text-purple-400 text-lg">$FRED</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Idea Card */}
          <div className="mb-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl">
                  💡
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Submit New Idea</h2>
                  <p className="text-white/50 text-sm">Share what you want Clawfred to build</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-sm">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                  Cost: {submitCost ? formatFredAmount(submitCost) : "..."} $FRED
                </span>
                <span className="text-white/40">(burned on submission)</span>
              </div>

              <textarea
                className="w-full h-32 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="What should Clawfred build next? Describe your idea..."
                value={ideaContent}
                onChange={e => setIdeaContent(e.target.value)}
                maxLength={2000}
                disabled={isSubmitting || isApprovingSubmit || isAnyMining}
              />

              <div className="flex justify-between items-center mt-4">
                <span className="text-white/30 text-sm">{ideaContent.length}/2000</span>

                {!connectedAddress ? (
                  <p className="text-red-400 text-sm">Connect wallet to submit</p>
                ) : !hasSubmitAllowance ? (
                  <button
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleApproveForSubmit}
                    disabled={isApprovingSubmit || isAnyMining || !submitCost}
                  >
                    {isApprovingSubmit ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Approving...
                      </span>
                    ) : (
                      `Approve ${submitCost ? formatFredAmount(submitCost) : "..."} FRED`
                    )}
                  </button>
                ) : (
                  <button
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSubmitIdea}
                    disabled={isSubmitting || !ideaContent.trim() || isAnyMining}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      "Submit Idea"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Admin Panel */}
          {isAdmin && (
            <div className="mb-8 p-6 rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-xl">
                  🔐
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-300">Admin Access</h2>
                  <p className="text-white/50 text-sm">You can approve or reject submissions</p>
                </div>
              </div>
            </div>
          )}

          {/* Ideas Section */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🚀</span>
              <h2 className="text-2xl font-bold text-white">Active Ideas</h2>
            </div>
            <p className="text-white/50 text-sm">
              Stake {stakeCost ? formatFredAmount(stakeCost) : "..."} $FRED to support ideas you believe in
            </p>
          </div>

          {/* Ideas List */}
          <IdeasList
            totalIdeas={Number(totalIdeas || 0)}
            connectedAddress={connectedAddress}
            isAdmin={isAdmin}
            onStake={handleStake}
            onApproveStake={handleApproveForStake}
            onMarkBuilt={handleMarkBuilt}
            onBurn={handleBurn}
            onClaim={handleClaim}
            stakingIdeaId={stakingIdeaId}
            approvingStakeIdeaId={approvingStakeIdeaId}
            markingBuiltId={markingBuiltId}
            burningId={burningId}
            claimingId={claimingId}
            payoutAmounts={payoutAmounts}
            setPayoutAmounts={setPayoutAmounts}
            hasStakeAllowance={!!hasStakeAllowance}
            isAnyMining={isAnyMining}
            stakeCost={stakeCost}
          />

          {(!totalIdeas || totalIdeas === 0n) && (
            <div className="text-center py-16 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
              <span className="text-6xl mb-4 block opacity-50">💭</span>
              <p className="text-xl text-white/60 mb-2">No ideas yet</p>
              <p className="text-white/40">Be the first to submit an idea above!</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-16 text-center">
            <p className="text-white/30 text-sm">
              🤖 Built by Clawfred • Experimental & Unaudited
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component to list all ideas
function IdeasList({
  totalIdeas,
  connectedAddress,
  isAdmin,
  onStake,
  onApproveStake,
  onMarkBuilt,
  onBurn,
  onClaim,
  stakingIdeaId,
  approvingStakeIdeaId,
  markingBuiltId,
  burningId,
  claimingId,
  payoutAmounts,
  setPayoutAmounts,
  hasStakeAllowance,
  isAnyMining,
  stakeCost,
}: {
  totalIdeas: number;
  connectedAddress: string | undefined;
  isAdmin: boolean;
  onStake: (id: number) => void;
  onApproveStake: (id: number) => void;
  onMarkBuilt: (id: number) => void;
  onBurn: (id: number) => void;
  onClaim: (id: number) => void;
  stakingIdeaId: number | null;
  approvingStakeIdeaId: number | null;
  markingBuiltId: number | null;
  burningId: number | null;
  claimingId: number | null;
  payoutAmounts: Record<number, string>;
  setPayoutAmounts: (val: Record<number, string>) => void;
  hasStakeAllowance: boolean;
  isAnyMining: boolean;
  stakeCost: bigint | undefined;
}) {
  const [ideaSortData, setIdeaSortData] = useState<
    Record<number, { totalStaked: bigint; isBurned: boolean; isBuilt: boolean }>
  >({});

  const handleIdeaDataLoaded = useCallback(
    (id: number, data: { totalStaked: bigint; isBurned: boolean; isBuilt: boolean }) => {
      setIdeaSortData(prev => {
        const existing = prev[id];
        if (
          existing &&
          existing.totalStaked === data.totalStaked &&
          existing.isBurned === data.isBurned &&
          existing.isBuilt === data.isBuilt
        ) {
          return prev;
        }
        return { ...prev, [id]: data };
      });
    },
    [],
  );

  const sortedIds = useMemo(() => {
    const ids = Array.from({ length: totalIdeas }, (_, i) => i + 1);
    return ids.sort((a, b) => {
      const dataA = ideaSortData[a];
      const dataB = ideaSortData[b];
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;
      if (dataA.isBurned && !dataB.isBurned) return 1;
      if (!dataA.isBurned && dataB.isBurned) return -1;
      if (dataA.isBurned && dataB.isBurned) return 0;
      if (dataA.isBuilt && !dataB.isBuilt) return 1;
      if (!dataA.isBuilt && dataB.isBuilt) return -1;
      if (dataA.totalStaked > dataB.totalStaked) return -1;
      if (dataA.totalStaked < dataB.totalStaked) return 1;
      return 0;
    });
  }, [ideaSortData, totalIdeas]);

  if (totalIdeas === 0) return null;

  return (
    <div className="space-y-4">
      {sortedIds.map(i => (
        <IdeaCard
          key={i}
          ideaId={i}
          connectedAddress={connectedAddress}
          isAdmin={isAdmin}
          onStake={onStake}
          onApproveStake={onApproveStake}
          onMarkBuilt={onMarkBuilt}
          onBurn={onBurn}
          onClaim={onClaim}
          isStaking={stakingIdeaId === i}
          isApprovingStake={approvingStakeIdeaId === i}
          isMarkingBuilt={markingBuiltId === i}
          isBurning={burningId === i}
          isClaiming={claimingId === i}
          payoutAmount={payoutAmounts[i] || ""}
          setPayoutAmount={val => setPayoutAmounts({ ...payoutAmounts, [i]: val })}
          hasStakeAllowance={hasStakeAllowance}
          isAnyMining={isAnyMining}
          stakeCost={stakeCost}
          onDataLoaded={handleIdeaDataLoaded}
        />
      ))}
    </div>
  );
}

// Individual idea card
function IdeaCard({
  ideaId,
  connectedAddress,
  isAdmin,
  onStake,
  onApproveStake,
  onMarkBuilt,
  onBurn,
  onClaim,
  isStaking,
  isApprovingStake,
  isMarkingBuilt,
  isBurning,
  isClaiming,
  payoutAmount,
  setPayoutAmount,
  hasStakeAllowance,
  isAnyMining,
  stakeCost,
  onDataLoaded,
}: {
  ideaId: number;
  connectedAddress: string | undefined;
  isAdmin: boolean;
  onStake: (id: number) => void;
  onApproveStake: (id: number) => void;
  onMarkBuilt: (id: number) => void;
  onBurn: (id: number) => void;
  onClaim: (id: number) => void;
  isStaking: boolean;
  isApprovingStake: boolean;
  isMarkingBuilt: boolean;
  isBurning: boolean;
  isClaiming: boolean;
  payoutAmount: string;
  setPayoutAmount: (val: string) => void;
  hasStakeAllowance: boolean;
  isAnyMining: boolean;
  stakeCost: bigint | undefined;
  onDataLoaded?: (id: number, data: { totalStaked: bigint; isBurned: boolean; isBuilt: boolean }) => void;
}) {
  const { data: ideaData } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "getIdea",
    args: [BigInt(ideaId)],
  });

  const { data: hasStaked } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "hasStaked",
    args: [BigInt(ideaId), connectedAddress as `0x${string}`],
  });

  const { data: canClaim } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "canClaim",
    args: [BigInt(ideaId), connectedAddress as `0x${string}`],
  });

  const { data: claimableAmount } = useScaffoldReadContract({
    contractName: "FredLabs",
    functionName: "getClaimableAmount",
    args: [BigInt(ideaId), connectedAddress as `0x${string}`],
  });

  useEffect(() => {
    if (ideaData && onDataLoaded) {
      const idea = ideaData as Idea;
      onDataLoaded(ideaId, {
        totalStaked: idea.totalStaked,
        isBurned: idea.isBurned,
        isBuilt: idea.isBuilt,
      });
    }
  }, [ideaData, ideaId, onDataLoaded]);

  if (!ideaData) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="h-20 bg-white/10 rounded"></div>
      </div>
    );
  }

  const idea = ideaData as Idea;

  // Burned idea
  if (idea.isBurned) {
    return (
      <div className="rounded-2xl bg-red-500/5 backdrop-blur-xl border border-red-500/20 overflow-hidden opacity-60">
        <div className="p-4 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center justify-between">
            <span className="text-red-400 text-sm font-medium">🔥 Rejected</span>
            <span className="text-white/30 text-sm">#{ideaId}</span>
          </div>
        </div>
        <div className="p-6">
          <p className="text-white/40 italic">This idea was rejected for violating guidelines.</p>
        </div>
      </div>
    );
  }

  const isSuccess = idea.isBuilt;

  return (
    <div className={`rounded-2xl backdrop-blur-xl border overflow-hidden transition-all hover:scale-[1.01] ${
      isSuccess 
        ? "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10" 
        : "bg-white/5 border-white/10 hover:border-purple-500/30"
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isSuccess ? "border-green-500/30 bg-green-500/10" : "border-white/10 bg-white/5"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-sm font-medium">#{ideaId}</span>
            {isSuccess && (
              <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold">
                ✓ Built
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-white/40 text-xs block">Total Staked</span>
              <span className="text-white font-bold">
                {formatFredAmount(idea.totalStaked)} <span className="text-purple-400 text-sm">$FRED</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-white/40 text-xs block">Stakers</span>
              <span className="text-white font-bold">{idea.stakerCount.toString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-white/90 whitespace-pre-wrap mb-4">{idea.content}</p>

        {/* Creator */}
        <div className="flex items-center gap-2 text-sm mb-4 pb-4 border-b border-white/10">
          <span className="text-white/40">Submitted by:</span>
          <Address address={idea.creator} />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Stake button */}
          {!idea.isBuilt && !hasStaked && connectedAddress && (
            !hasStakeAllowance ? (
              <button
                className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all disabled:opacity-50"
                onClick={() => onApproveStake(ideaId)}
                disabled={isApprovingStake || isAnyMining || !stakeCost}
              >
                {isApprovingStake || isAnyMining ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
                    {isApprovingStake ? "Approving..." : "Processing..."}
                  </span>
                ) : (
                  `Approve ${stakeCost ? formatFredAmount(stakeCost) : "..."} FRED`
                )}
              </button>
            ) : (
              <button
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                onClick={() => onStake(ideaId)}
                disabled={isStaking || isAnyMining}
              >
                {isStaking || isAnyMining ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isStaking ? "Staking..." : "Processing..."}
                  </span>
                ) : (
                  `💰 Stake ${stakeCost ? formatFredAmount(stakeCost) : "..."} FRED`
                )}
              </button>
            )
          )}

          {/* Already staked */}
          {hasStaked && !idea.isBuilt && (
            <span className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-300 text-sm font-medium">
              ✓ You staked on this
            </span>
          )}

          {/* Claim button */}
          {idea.isBuilt && canClaim && (
            <button
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
              onClick={() => onClaim(ideaId)}
              disabled={isClaiming || isAnyMining}
            >
              {isClaiming || isAnyMining ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Claiming...
                </span>
              ) : (
                `🎁 Claim ${claimableAmount ? formatFredAmount(claimableAmount) : "0"} FRED`
              )}
            </button>
          )}

          {/* Admin actions */}
          {isAdmin && !idea.isBuilt && (
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="number"
                className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                placeholder="Payout"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                disabled={isMarkingBuilt || isAnyMining}
              />
              <button
                className="px-3 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm font-medium transition-all disabled:opacity-50"
                onClick={() => onMarkBuilt(ideaId)}
                disabled={isMarkingBuilt || isAnyMining}
              >
                {isMarkingBuilt ? "..." : "✓ Approve"}
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm font-medium transition-all disabled:opacity-50"
                onClick={() => onBurn(ideaId)}
                disabled={isBurning || isAnyMining}
              >
                {isBurning ? "..." : "🔥 Reject"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
