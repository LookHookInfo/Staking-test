import { useState, useEffect } from "react";
import {
  useActiveAccount,
  TransactionButton,
  useSendAndConfirmTransaction,
} from "thirdweb/react";
import { prepareContractCall, toWei } from "thirdweb";
import { staking } from "../../utils/contracts";

interface UserStakesDisplayProps {
  stakingContract: any;
  refetchAvailableRewards: () => void;
  refetchAllowance: () => void;
  refetchBalance: () => void;
  setError: (error: string | null) => void;
  account: any;
  userStakes: any;
  isLoadingUserStakes: boolean;
  refetchUserStakes: () => void;
  userStakeSummary: any;
  isLoadingUserStakeSummary: boolean;
  poolInfo: any;
  isLoadingPoolInfo: boolean;
  refetchUserStakeSummary: () => void;
  refetchPoolInfo: () => void;
  amount: string;
  tokenContract: any;
  allowance: any;
  isLoadingAllowance: boolean;
  isApproved: (amount: string) => boolean;
  apr3M: any;
  apr6M: any;
  apr12M: any;
}

const formatRemainingTime = (remainingSeconds: bigint) => {
  if (remainingSeconds <= 0n) return "Finished";
  const days = remainingSeconds / BigInt(86400);
  const hours = (remainingSeconds % BigInt(86400)) / BigInt(3600);
  const minutes = (remainingSeconds % BigInt(3600)) / BigInt(60);
  return `${days}d ${hours}h ${minutes}m`;
};

function TierDisplay({ tierId, tierName, stakeData, amount, tokenContract, stakingContract, allowance, refetchAllowance, refetchUserStakes, setError, refetchBalance, isApproved, apr }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction(); // Use mutateAsync for easier chaining

  const handleStaking = async () => {
    setLocalError(null);
    setIsProcessing(true);

    try {
      const amountWei = toWei(amount); // Calculate once

      // 1. Check allowance and approve if necessary
      if (!isApproved(amount)) {
        // @ts-ignore
        const approveTx = prepareContractCall({
          contract: tokenContract as any, // Cast to any
          method: 'approve',
          params: [staking, amountWei],
        });
        // @ts-ignore
        await sendAndConfirm(approveTx as any); // Cast the PreparedTransaction to any
        await refetchAllowance(); // Ensure allowance is updated in state
      }

      // 2. Stake the tokens
      // @ts-ignore
      const stakeTx = prepareContractCall({
        contract: stakingContract as any, // Cast to any
        method: "stake",
        params: [amountWei, BigInt(tierId)],
      });
      // @ts-ignore
      await sendAndConfirm(stakeTx as any); // Cast the PreparedTransaction to any
      console.log("Stake transaction confirmed.");

      // 3. Refetch all relevant data after successful staking
      await refetchAllowance();
      await refetchBalance();
      await refetchUserStakes();

    } catch (err: any) {
      console.error("Staking error:", err);
      setLocalError(err.message || "An unknown error occurred during staking.");
      setError(err.message || "An unknown error occurred during staking.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (stakeData.amount > 0n) {
    // Active stake
    return (
      <div style={{ border: "1px solid grey", padding: "10px", margin: "10px 0" }}>
        <h3>{tierName} - {(BigInt(apr || 0n) / 100n).toString()}% APR</h3>
        <p><strong>Staked:</strong> {(stakeData.amount / BigInt(10**18)).toString()} HASH</p>
        <p><strong>Remaining:</strong> {formatRemainingTime(stakeData.timeLeft)}</p>
        <p><strong>Claimable Rewards:</strong> {(stakeData.rewards / BigInt(10**18)).toString()} HASH</p>
        {stakeData.timeLeft > 0n ? (
          <TransactionButton
            transaction={() => prepareContractCall({ contract: stakingContract, method: "claimReward", params: [tierId] })}
            onTransactionConfirmed={() => { refetchUserStakes(); }}
            onError={(err) => setError(err.message)}
            disabled={stakeData.rewards <= 0n}
          >
            Claim Rewards
          </TransactionButton>
        ) : (
            stakeData.rewards > 0n ? (
                <TransactionButton
                    transaction={() => prepareContractCall({ contract: stakingContract, method: "claimReward", params: [tierId] })}
                    onTransactionConfirmed={() => {
                    refetchUserStakes();
                    }}
                    onError={(err) => setError(err.message)}
                >
                    Claim Rewards
                </TransactionButton>
            ) : (
                <TransactionButton
                    transaction={() => prepareContractCall({ contract: stakingContract, method: "unstake", params: [tierId] })}
                    onTransactionConfirmed={() => {
                    refetchAllowance();
                    refetchBalance();
                    refetchUserStakes();
                    }}
                    onError={(err) => setError(err.message)}
                >
                    Unstake
                </TransactionButton>
            )
        )}
      </div>
    );
  }

  // No active stake
  return (
    <div style={{ border: "1px solid grey", padding: "10px", margin: "10px 0" }}>
      <h3>{tierName}</h3>
      <button
        onClick={handleStaking}
        disabled={isProcessing || !amount || Number(amount) <= 0}
        style={{ padding: "8px 15px", cursor: "pointer" }}
      >
        {isProcessing
          ? "Processing..."
          : !isApproved(amount)
          ? "Approve & Stake"
          : "Stake"}
      </button>
      {localError && <p style={{ color: "red" }}>{localError}</p>}
    </div>
  );
}

export default function UserStakesDisplay(props: UserStakesDisplayProps) {

  // ======= Prepare variables for display =======
  let s3 = { amount: 0n, rewards: 0n, timeLeft: 0n };
  let s6 = { amount: 0n, rewards: 0n, timeLeft: 0n };
  let s12 = { amount: 0n, rewards: 0n, timeLeft: 0n };

  if (props.userStakes) {
    s3 = {
      amount: BigInt(props.userStakes[0] || 0n),
      rewards: BigInt(props.userStakes[1] || 0n),
      timeLeft: BigInt(props.userStakes[2] || 0n),
    };
    s6 = {
      amount: BigInt(props.userStakes[3] || 0n),
      rewards: BigInt(props.userStakes[4] || 0n),
      timeLeft: BigInt(props.userStakes[5] || 0n),
    };
    s12 = {
      amount: BigInt(props.userStakes[6] || 0n),
      rewards: BigInt(props.userStakes[7] || 0n),
      timeLeft: BigInt(props.userStakes[8] || 0n),
    };
  }

  return (
    <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "15px", borderRadius: "5px" }}>
      <h2>Your Stakes</h2>
      <button onClick={() => { props.refetchUserStakes(); props.refetchUserStakeSummary(); props.refetchPoolInfo(); }} style={{ marginBottom: "10px", padding: "8px 15px", cursor: "pointer" }}>Refresh Stakes</button>
      {props.isLoadingUserStakes || props.isLoadingUserStakeSummary || props.isLoadingPoolInfo ? (
        <p>Loading your stakes...</p>
      ) : !props.userStakes ? (
        <p>Could not load stake data. Please ensure your wallet is connected and try refreshing.</p>
      ) : (
        <>
          <div style={{ marginBottom: "20px" }}>
            <h3>Summary</h3>
            <p><strong>Your Total Staked:</strong> {props.userStakeSummary && props.userStakeSummary[0] ? (BigInt(props.userStakeSummary[0]) / BigInt(10**18)).toString() : '0'} HASH</p>
            <p><strong>Your Total Rewards:</strong> {props.userStakeSummary && props.userStakeSummary[1] ? (BigInt(props.userStakeSummary[1]) / BigInt(10**18)).toString() : '0'} HASH</p>
            <p><strong>Total Staked in Pool:</strong> {props.poolInfo && props.poolInfo[0] ? (BigInt(props.poolInfo[0]) / BigInt(10**18)).toString() : '0'} HASH</p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: "10px" }}>
            <TierDisplay tierId={1} tierName="3M Tier" stakeData={s3} apr={props.apr3M} {...props} />
            <TierDisplay tierId={2} tierName="6M Tier" stakeData={s6} apr={props.apr6M} {...props} />
            <TierDisplay tierId={3} tierName="12M Tier" stakeData={s12} apr={props.apr12M} {...props} />
          </div>
        </>
      )}
    </div>
  );
}