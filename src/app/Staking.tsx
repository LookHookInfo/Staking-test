import { useState, useEffect } from "react";
import {
  ConnectButton,
  useActiveAccount,
  useReadContract,
  TransactionButton,
} from "thirdweb/react";
import { getContract, prepareContractCall, toWei, type ThirdwebContract } from "thirdweb";
import { client } from "./client";
import { chain } from "./chain";
import { staking, hashTokenAddress } from "../../utils/contracts";
import stakingAbi from "../../utils/stakingAbi";
import erc20Abi from "../../utils/erc20";
import UserStakesDisplay from "./UserStakesDisplay";

export default function Staking() {
  const account = useActiveAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  const tokenContract: ThirdwebContract<typeof erc20Abi> = getContract({
    client,
    chain,
    address: hashTokenAddress,
    abi: erc20Abi,
  });

  const stakingContract: ThirdwebContract<typeof stakingAbi> = getContract({
    client,
    chain,
    address: staking,
    abi: stakingAbi,
  });

  // 🔹 Token balance & allowance
  const { data: userBalance, refetch: refetchBalance, isLoading: isLoadingBalance } = useReadContract({
    contract: tokenContract,
    method: "balanceOf",
    params: [account?.address || "0x0"],
    queryOptions: { enabled: !!account?.address },
  });

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
    contract: tokenContract,
    method: "allowance",
    params: [account?.address || "0x0", staking],
    queryOptions: { enabled: !!account?.address },
  });

  // 🔹 Contract data
  const { data: availableRewards, refetch: refetchAvailableRewards, isLoading: isLoadingAvailableRewards } = useReadContract({
    contract: stakingContract,
    method: "availableRewards",
    params: [],
  });

  const { data: userStakes, refetch: refetchUserStakes, isLoading: isLoadingUserStakes } = useReadContract({
    contract: stakingContract,
    method: "getUserStakes",
    params: [account?.address || "0x0"],
    queryOptions: { enabled: !!account?.address },
  });

  const { data: apr3M } = useReadContract({ contract: stakingContract, method: "APR_3M", params: [] });
  const { data: apr6M } = useReadContract({ contract: stakingContract, method: "APR_6M", params: [] });
  const { data: apr12M } = useReadContract({ contract: stakingContract, method: "APR_12M", params: [] });

  const { data: userStakeSummary, refetch: refetchUserStakeSummary, isLoading: isLoadingUserStakeSummary } = useReadContract({
    contract: stakingContract,
    method: "getUserStakeSummary",
    params: [account?.address || "0x0"],
    queryOptions: { enabled: !!account?.address },
  });

  const { data: poolInfo, refetch: refetchPoolInfo, isLoading: isLoadingPoolInfo } = useReadContract({
    contract: stakingContract,
    method: "getPoolInfo",
    params: [],
  });

  // 🔹 Input handling
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (Number(value) < 0) {
      setAmount("0");
    }
    else {
      setAmount(value);
    }
  };

  const getPreparedFund = () => {
    if (!fundAmount || Number(fundAmount) <= 0) throw new Error("Invalid amount for fund");
    return prepareContractCall({
      contract: stakingContract,
      method: "fundRewards",
      params: [toWei(fundAmount)],
    });
  };

  const isApproved = (amountToApprove: string) => {
    if (!amountToApprove || isNaN(Number(amountToApprove)) || !allowance) return false;
    try {
      const amountWei = toWei(amountToApprove);
      return BigInt(amountWei) <= BigInt(allowance.toString());
    } catch {
      return false;
    }
  };

  const canApproveFund = !!fundAmount && Number(fundAmount) > 0;

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Staking App</h1>
        <ConnectButton client={client} chain={chain} />
      </div>

      {account ? (
        <>
          {/* 🔹 Token Info */}
          <div style={{ marginTop: "20px", border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
            <h2>Token Info</h2>
            {isLoadingBalance || isLoadingAllowance || isLoadingAvailableRewards ? (
              <p>Loading...</p>
            ) : (
              <>
                <p><strong>Token Address:</strong> {tokenContract.address}</p>
                <p><strong>Allowance:</strong> {(BigInt(allowance || 0n) / 10n ** 18n).toString()} HASH</p>
                <p><strong>Available Rewards:</strong> {(BigInt(availableRewards || 0n) / 10n ** 18n).toString()} HASH</p>
              </>
            )}
          </div>

          {/* 🔹 Stake Section */}
          <div style={{ marginTop: "20px", border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
            <h2>Stake HASH</h2>
            <p><strong>Your Balance:</strong> {(BigInt(userBalance || 0n) / 10n ** 18n).toString()} HASH</p>
            <input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Amount to stake"
              min="0"
              style={{ width: "100%", padding: "8px", boxSizing: "border-box", marginBottom: "10px" }}
            />
            {error && <p style={{ color: "red" }}>{error}</p>}
          </div>

          {/* 🔹 User Stakes */}
          <UserStakesDisplay
            stakingContract={stakingContract}
            refetchAvailableRewards={refetchAvailableRewards}
            refetchAllowance={refetchAllowance}
            refetchBalance={refetchBalance}
            setError={setError}
            account={account}
            userStakes={userStakes}
            isLoadingUserStakes={isLoadingUserStakes}
            refetchUserStakes={refetchUserStakes}
            userStakeSummary={userStakeSummary}
            isLoadingUserStakeSummary={isLoadingUserStakeSummary}
            poolInfo={poolInfo}
            isLoadingPoolInfo={isLoadingPoolInfo}
            refetchUserStakeSummary={refetchUserStakeSummary}
            refetchPoolInfo={refetchPoolInfo}
            amount={amount}
            tokenContract={tokenContract}
            allowance={allowance}
            isLoadingAllowance={isLoadingAllowance}
            isApproved={isApproved}
            apr3M={apr3M}
            apr6M={apr6M}
            apr12M={apr12M}
          />

          {/* 🔹 Fund Contract */}
          <div style={{ marginTop: "20px", border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
            <h2>Fund Contract</h2>
            <input
              type="number"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="Amount to fund"
              min="0"
              style={{ width: "100%", padding: "8px", boxSizing: "border-box", marginBottom: "10px" }}
            />
            {!isApproved(fundAmount) ? (
              canApproveFund ? (
                <TransactionButton
                  transaction={() => prepareContractCall({ contract: tokenContract, method: 'approve', params: [staking, toWei(fundAmount)] })}
                  onTransactionConfirmed={() => refetchAllowance()}
                  onError={(err) => setError(err.message)}
                >
                  Approve Fund
                </TransactionButton>
              ) : (
                <button disabled>Approve Fund</button>
              )
            ) : (
              <TransactionButton
                transaction={getPreparedFund}
                onTransactionConfirmed={() => {
                  setFundAmount("");
                  refetchAvailableRewards();
                }}
                onError={(err) => setError(err.message)}
              >
                Fund Contract
              </TransactionButton>
            )}
          </div>
        </>
      ) : (
        <p style={{ marginTop: "20px" }}>Please connect your wallet to continue.</p>
      )}
    </div>
  );
}