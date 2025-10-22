// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title HASH Staking Multi-Tier v2.3 (TEST VERSION - Hours)
 * @notice Enhanced version with better frontend integration
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract HASHStakingMultiTierV2_3 {
    // ====== TOKEN SETTINGS ======
    IERC20 public immutable HASH;
    
    // TEST CONFIG: Hours instead of months
    uint256 public constant HOUR = 3600;
    uint256 public constant BPS = 10000;

    // APRs for test
    uint256 public constant APR_3H = 300;   // 3%
    uint256 public constant APR_6H = 500;   // 5%
    uint256 public constant APR_12H = 900;  // 9%

    // Minimum stake to prevent dust attacks
    uint256 public constant MIN_STAKE = 1 ether; // 1 HASH (assuming 18 decimals)

    enum Tier { NONE, H3, H6, H12 }

    struct StakeInfo {
        uint256 amount;
        uint256 start;
        uint256 lastClaim;
        uint256 finish;
        bool active;
    }

    mapping(address => StakeInfo) public stakes3H;
    mapping(address => StakeInfo) public stakes6H;
    mapping(address => StakeInfo) public stakes12H;

    mapping(address => uint256) public pendingRewards3H;
    mapping(address => uint256) public pendingRewards6H;
    mapping(address => uint256) public pendingRewards12H;

    // Statistics
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    address[] private stakers;
    mapping(address => bool) private hasStakedBefore;

    // Reentrancy guard
    uint8 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrancy blocked");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ====== EVENTS ======
    event UserAction(
        address indexed user,
        string action,
        uint8 tier,
        uint256 amount,
        uint256 timestamp
    );
    event Funded(address indexed from, uint256 amount);
    event StakeCreated(address indexed user, uint8 tier, uint256 amount, uint256 start, uint256 finish);
    event RewardClaimed(address indexed user, uint8 tier, uint256 amount);
    event Unstaked(address indexed user, uint8 tier, uint256 stakedAmount, uint256 reward);
    event PendingClaimed(address indexed user, uint8 tier, uint256 amount);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Zero token address");
        HASH = IERC20(tokenAddress);
    }

    // ====== ENHANCED FRONTEND FUNCTIONS ======
    /**
     * @dev Get comprehensive stake information for frontend
     * Returns all data needed for UI in single call
     */
    function getUserStakes(address user) external view returns (
        uint256 staked3H,
        uint256 rewards3H,
        uint256 timeLeft3H,
        uint256 staked6H,
        uint256 rewards6H,
        uint256 timeLeft6H,
        uint256 staked12H,
        uint256 rewards12H,
        uint256 timeLeft12H
    ) {
        uint256 currentTime = block.timestamp;
        
        // 3H Tier
        StakeInfo memory s3 = stakes3H[user];
        staked3H = s3.active ? s3.amount : 0;
        rewards3H = s3.active ? _calculateCurrentReward(user, 1) + pendingRewards3H[user] : 0;
        timeLeft3H = s3.active && currentTime < s3.finish ? s3.finish - currentTime : 0;

        // 6H Tier
        StakeInfo memory s6 = stakes6H[user];
        staked6H = s6.active ? s6.amount : 0;
        rewards6H = s6.active ? _calculateCurrentReward(user, 2) + pendingRewards6H[user] : 0;
        timeLeft6H = s6.active && currentTime < s6.finish ? s6.finish - currentTime : 0;

        // 12H Tier
        StakeInfo memory s12 = stakes12H[user];
        staked12H = s12.active ? s12.amount : 0;
        rewards12H = s12.active ? _calculateCurrentReward(user, 3) + pendingRewards12H[user] : 0;
        timeLeft12H = s12.active && currentTime < s12.finish ? s12.finish - currentTime : 0;
    }

    /**
     * @dev Get user's stake summary (total across all tiers)
     */
    function getUserStakeSummary(address user) external view returns (
        uint256 totalStakedAmount,
        uint256 totalRewards,
        uint256 totalPending,
        uint256 activeTiers
    ) {
        // Вычисляем напрямую без вызова getUserStakes
        StakeInfo memory s3 = stakes3H[user];
        StakeInfo memory s6 = stakes6H[user];
        StakeInfo memory s12 = stakes12H[user];
        
        totalStakedAmount = (s3.active ? s3.amount : 0) + 
                           (s6.active ? s6.amount : 0) + 
                           (s12.active ? s12.amount : 0);
        
        totalRewards = (s3.active ? _calculateCurrentReward(user, 1) : 0) +
                      (s6.active ? _calculateCurrentReward(user, 2) : 0) +
                      (s12.active ? _calculateCurrentReward(user, 3) : 0);
        
        totalPending = pendingRewards3H[user] + pendingRewards6H[user] + pendingRewards12H[user];
        
        activeTiers = 0;
        if (s3.active) activeTiers++;
        if (s6.active) activeTiers++;
        if (s12.active) activeTiers++;
    }

    // ====== GALXE / LAYER3 / ZEALY INTEGRATION ======
    function isStaking(address user) external view returns (bool active3h, bool active6h, bool active12h) {
        active3h = stakes3H[user].active;
        active6h = stakes6H[user].active;
        active12h = stakes12H[user].active;
    }

    function hasEverStaked(address user) external view returns (bool) {
        return hasStakedBefore[user];
    }

    function getActiveStakeAmounts(address user) external view returns (
        uint256 amount3h,
        uint256 amount6h, 
        uint256 amount12h
    ) {
        amount3h = stakes3H[user].active ? stakes3H[user].amount : 0;
        amount6h = stakes6H[user].active ? stakes6H[user].amount : 0;
        amount12h = stakes12H[user].active ? stakes12H[user].amount : 0;
    }

    // ====== FUND POOL ======
    function fundRewards(uint256 amount) external nonReentrant returns (bool) {
        require(amount > 0, "amount=0");
        _safeTransferFrom(HASH, msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
        emit UserAction(msg.sender, "fund", 0, amount, block.timestamp);
        return true;
    }

    function availableRewards() public view returns (uint256) {
        return HASH.balanceOf(address(this)) - totalStaked;
    }

    // ====== STAKING ======
    function stake(uint256 amount, uint8 tierId) external nonReentrant returns (bool) {
        require(amount >= MIN_STAKE, "below min stake");
        require(tierId >= 1 && tierId <= 3, "invalid tier");

        StakeInfo storage s = _getStakeInfo(msg.sender, tierId);
        require(!s.active, "already active in this tier");

        _safeTransferFrom(HASH, msg.sender, address(this), amount);

        (uint256 apr, uint256 duration) = _getAprAndDuration(tierId);
        require(apr > 0, "invalid apr");

        uint256 start = block.timestamp;
        uint256 finish = start + duration;

        s.amount = amount;
        s.start = start;
        s.lastClaim = start;
        s.finish = finish;
        s.active = true;

        totalStaked += amount;

        if (!hasStakedBefore[msg.sender]) {
            hasStakedBefore[msg.sender] = true;
            stakers.push(msg.sender);
        }

        emit StakeCreated(msg.sender, tierId, amount, start, finish);
        emit UserAction(msg.sender, "stake", tierId, amount, start);

        return true;
    }

    // ====== CLAIM REWARDS (anytime) ======
    function claimReward(uint8 tierId) external nonReentrant returns (bool) {
        require(tierId >= 1 && tierId <= 3, "invalid tier");
        StakeInfo storage s = _getStakeInfo(msg.sender, tierId);
        require(s.active, "no active stake");

        uint256 reward = claimable(msg.sender, tierId);
        uint256 pending = _getPending(msg.sender, tierId);
        require(reward > 0 || pending > 0, "no reward available");

        uint256 totalToPay = reward + pending;
        uint256 available = availableRewards();
        uint256 actuallyPaid = 0;
        uint256 newPending = 0;

        // Calculate what we can pay
        if (available >= totalToPay) {
            actuallyPaid = totalToPay;
            newPending = 0;
        } else {
            actuallyPaid = available;
            newPending = totalToPay - available;
        }

        // Process payment FIRST
        if (actuallyPaid > 0) {
            _safeTransfer(HASH, msg.sender, actuallyPaid);
            totalRewardsDistributed += actuallyPaid;
        }

        // Update state ONLY after successful transfer
        if (reward > 0) {
            uint256 nowTime = block.timestamp;
            if (nowTime > s.finish) nowTime = s.finish;
            s.lastClaim = nowTime;
        }
        
        _setPending(msg.sender, tierId, newPending);

        emit RewardClaimed(msg.sender, tierId, actuallyPaid);
        emit UserAction(msg.sender, "claim", tierId, actuallyPaid, block.timestamp);

        return true;
    }

    // ====== CLAIM PENDING REWARDS ======
    function claimPending(uint8 tierId) external nonReentrant returns (bool) {
        require(tierId >= 1 && tierId <= 3, "invalid tier");
        
        uint256 pending = _getPending(msg.sender, tierId);
        require(pending > 0, "no pending rewards");
        
        uint256 available = availableRewards();
        require(available > 0, "no rewards in pool");

        uint256 toPay = (available > pending) ? pending : available;
        uint256 remainingPending = pending - toPay;

        // Transfer FIRST
        _safeTransfer(HASH, msg.sender, toPay);
        totalRewardsDistributed += toPay;

        // Update state AFTER
        _setPending(msg.sender, tierId, remainingPending);

        emit PendingClaimed(msg.sender, tierId, toPay);
        emit UserAction(msg.sender, "pendingClaim", tierId, toPay, block.timestamp);

        return true;
    }

    // ====== UNSTAKE (only after finish) ======
    function unstake(uint8 tierId) external nonReentrant returns (bool) {
        require(tierId >= 1 && tierId <= 3, "invalid tier");
        StakeInfo storage s = _getStakeInfo(msg.sender, tierId);
        require(s.active, "no active stake");
        require(block.timestamp >= s.finish, "still locked");

        // Calculate everything BEFORE state changes
        uint256 stakedAmount = s.amount;
        uint256 reward = claimable(msg.sender, tierId);
        uint256 pending = _getPending(msg.sender, tierId);
        uint256 totalReward = reward + pending;
        
        uint256 available = availableRewards();
        uint256 rewardsToPay = (available >= totalReward) ? totalReward : available;
        uint256 remainingPending = totalReward - rewardsToPay;
        
        uint256 totalToTransfer = stakedAmount + rewardsToPay;

        // TRANSFER FIRST (most important!)
        _safeTransfer(HASH, msg.sender, totalToTransfer);
        
        if (rewardsToPay > 0) {
            totalRewardsDistributed += rewardsToPay;
        }

        // UPDATE STATE ONLY AFTER SUCCESSFUL TRANSFER
        totalStaked -= stakedAmount;
        
        s.active = false;
        s.amount = 0;
        s.start = 0;
        s.finish = 0;
        s.lastClaim = 0;
        
        _setPending(msg.sender, tierId, remainingPending);

        emit Unstaked(msg.sender, tierId, stakedAmount, totalReward);
        emit UserAction(msg.sender, "unstake", tierId, stakedAmount, block.timestamp);

        return true;
    }

    // ====== VIEW FUNCTIONS ======
    function claimable(address user, uint8 tierId) public view returns (uint256) {
        return _calculateCurrentReward(user, tierId);
    }

    function getPoolInfo() external view returns (
        uint256 totalStakedAmount,
        uint256 availableRewardAmount,
        uint256 totalRewardsPaid,
        uint256 stakersCount,
        uint256 contractBalance
    ) {
        return (
            totalStaked,
            availableRewards(),
            totalRewardsDistributed,
            stakers.length,
            HASH.balanceOf(address(this))
        );
    }

    function getAllStakers() external view returns (address[] memory) {
        return stakers;
    }

    function totalStakers() external view returns (uint256) {
        return stakers.length;
    }

    function getTierInfo(uint8 tierId) external pure returns (uint256 aprBps, uint256 durationHours) {
        if (tierId == 1) return (APR_3H, 3);
        if (tierId == 2) return (APR_6H, 6);
        if (tierId == 3) return (APR_12H, 12);
        return (0, 0);
    }

    // ====== INTERNAL ======
    function _calculateCurrentReward(address user, uint8 tierId) internal view returns (uint256) {
        StakeInfo storage s = _getStakeInfo(user, tierId);
        if (!s.active) return 0;
        
        (uint256 aprBps, ) = _getAprAndDuration(tierId);
        uint256 from = s.lastClaim;
        uint256 to = block.timestamp;
        if (to > s.finish) to = s.finish;
        if (from >= to) return 0;
        
        uint256 elapsed = to - from;
        return (s.amount * aprBps * elapsed) / (BPS * 365 days);
    }

    function _getStakeInfo(address user, uint8 tierId) internal view returns (StakeInfo storage) {
        if (tierId == 1) return stakes3H[user];
        if (tierId == 2) return stakes6H[user];
        if (tierId == 3) return stakes12H[user];
        revert("invalid tier");
    }

    function _getPending(address user, uint8 tierId) internal view returns (uint256) {
        if (tierId == 1) return pendingRewards3H[user];
        if (tierId == 2) return pendingRewards6H[user];
        if (tierId == 3) return pendingRewards12H[user];
        return 0;
    }

    function _setPending(address user, uint8 tierId, uint256 value) internal {
        if (tierId == 1) pendingRewards3H[user] = value;
        else if (tierId == 2) pendingRewards6H[user] = value;
        else if (tierId == 3) pendingRewards12H[user] = value;
    }

    function _getAprAndDuration(uint8 tierId) internal pure returns (uint256 apr, uint256 duration) {
        if (tierId == 1) return (APR_3H, 3 * HOUR);
        if (tierId == 2) return (APR_6H, 6 * HOUR);
        if (tierId == 3) return (APR_12H, 12 * HOUR);
        revert("invalid tier");
    }

    function _safeTransfer(IERC20 token, address to, uint256 value) internal {
        require(token.transfer(to, value), "transfer failed");
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        require(token.transferFrom(from, to, value), "transferFrom failed");
    }
}