// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FredLabs
 * @notice Submit ideas (burn FRED as fee), stake on ideas, 
 *         admin can mark as built (with payout) or burn offensive content.
 * @dev Rebranded from IdeaLabs for the $FRED token community
 */
contract FredLabs is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    IERC20 public immutable fredToken;
    address public immutable admin;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // Costs in FRED (18 decimals) - these can be adjusted for FRED's price
    uint256 public constant SUBMIT_COST = 1000000 * 10**18;  // 1M FRED to submit
    uint256 public constant STAKE_COST = 500000 * 10**18;    // 500K FRED to stake

    // =============================================================
    //                           STORAGE
    // =============================================================

    struct Idea {
        uint256 id;
        address creator;
        string content;
        uint256 totalStaked;
        uint256 stakerCount;
        bool isBuilt;
        bool isBurned;
        uint256 payoutPool;
        uint256 createdAt;
    }

    uint256 public nextIdeaId;
    mapping(uint256 => Idea) public ideas;
    mapping(uint256 => mapping(address => bool)) public hasStaked;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => address[]) public ideaStakers;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event IdeaSubmitted(uint256 indexed ideaId, address indexed creator, string content);
    event IdeaStaked(uint256 indexed ideaId, address indexed staker, uint256 totalStaked, uint256 stakerCount);
    event IdeaMarkedBuilt(uint256 indexed ideaId, uint256 payoutPool);
    event IdeaBurned(uint256 indexed ideaId, uint256 burnedAmount);
    event PayoutClaimed(uint256 indexed ideaId, address indexed staker, uint256 amount);

    // =============================================================
    //                           CONSTRUCTOR
    // =============================================================

    constructor(address _fredToken, address _admin) {
        fredToken = IERC20(_fredToken);
        admin = _admin;
        nextIdeaId = 1;
    }

    // =============================================================
    //                         MODIFIERS
    // =============================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // =============================================================
    //                      USER FUNCTIONS
    // =============================================================

    /**
     * @notice Submit a new idea. Burns SUBMIT_COST FRED.
     * @param _content The idea text content
     */
    function submitIdea(string calldata _content) external nonReentrant {
        require(bytes(_content).length > 0, "Content cannot be empty");
        require(bytes(_content).length <= 2000, "Content too long");

        // Transfer FRED from user and burn it
        fredToken.safeTransferFrom(msg.sender, DEAD_ADDRESS, SUBMIT_COST);

        uint256 ideaId = nextIdeaId++;
        ideas[ideaId] = Idea({
            id: ideaId,
            creator: msg.sender,
            content: _content,
            totalStaked: 0,
            stakerCount: 0,
            isBuilt: false,
            isBurned: false,
            payoutPool: 0,
            createdAt: block.timestamp
        });

        emit IdeaSubmitted(ideaId, msg.sender, _content);
    }

    /**
     * @notice Stake on an idea. Pays STAKE_COST FRED.
     *         ONE stake per address per idea (no sybil stacking).
     * @param _ideaId The idea to stake on
     */
    function stakeOnIdea(uint256 _ideaId) external nonReentrant {
        Idea storage idea = ideas[_ideaId];
        require(idea.creator != address(0), "Idea does not exist");
        require(!idea.isBuilt, "Idea already built");
        require(!idea.isBurned, "Idea was burned");
        require(!hasStaked[_ideaId][msg.sender], "Already staked on this idea");

        // Transfer FRED from user to contract (held until built or burned)
        fredToken.safeTransferFrom(msg.sender, address(this), STAKE_COST);

        hasStaked[_ideaId][msg.sender] = true;
        ideaStakers[_ideaId].push(msg.sender);
        idea.totalStaked += STAKE_COST;
        idea.stakerCount++;

        emit IdeaStaked(_ideaId, msg.sender, idea.totalStaked, idea.stakerCount);
    }

    /**
     * @notice Claim payout share from a built idea.
     *         Payout is split equally among stakers.
     * @param _ideaId The idea to claim from
     */
    function claimPayout(uint256 _ideaId) external nonReentrant {
        Idea storage idea = ideas[_ideaId];
        require(idea.isBuilt, "Idea not built yet");
        require(hasStaked[_ideaId][msg.sender], "Not a staker");
        require(!hasClaimed[_ideaId][msg.sender], "Already claimed");
        require(idea.payoutPool > 0, "No payout available");

        hasClaimed[_ideaId][msg.sender] = true;

        // Equal share for each staker
        uint256 share = idea.payoutPool / idea.stakerCount;
        require(share > 0, "Share too small");

        fredToken.safeTransfer(msg.sender, share);

        emit PayoutClaimed(_ideaId, msg.sender, share);
    }

    // =============================================================
    //                       ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Mark an idea as built and set the payout pool amount.
     *         Admin must have transferred FRED to this contract first.
     * @param _ideaId The idea to mark as built
     * @param _payoutAmount Total FRED to distribute to stakers
     */
    function markBuilt(uint256 _ideaId, uint256 _payoutAmount) external onlyAdmin nonReentrant {
        Idea storage idea = ideas[_ideaId];
        require(idea.creator != address(0), "Idea does not exist");
        require(!idea.isBuilt, "Already built");
        require(!idea.isBurned, "Idea was burned");

        // If there's a payout, ensure contract has enough FRED
        if (_payoutAmount > 0 && idea.stakerCount > 0) {
            require(
                fredToken.balanceOf(address(this)) >= idea.totalStaked + _payoutAmount,
                "Insufficient FRED for payout"
            );
        }

        idea.isBuilt = true;
        idea.payoutPool = _payoutAmount;

        emit IdeaMarkedBuilt(_ideaId, _payoutAmount);
    }

    /**
     * @notice Burn an idea's stake pool (for offensive content).
     *         Sends all staked FRED to the dead address.
     * @param _ideaId The idea to burn
     */
    function burnIdea(uint256 _ideaId) external onlyAdmin nonReentrant {
        Idea storage idea = ideas[_ideaId];
        require(idea.creator != address(0), "Idea does not exist");
        require(!idea.isBuilt, "Already built");
        require(!idea.isBurned, "Already burned");

        uint256 burnAmount = idea.totalStaked;
        idea.isBurned = true;

        if (burnAmount > 0) {
            fredToken.safeTransfer(DEAD_ADDRESS, burnAmount);
        }

        emit IdeaBurned(_ideaId, burnAmount);
    }

    /**
     * @notice Deposit FRED into contract for payouts.
     *         Anyone can deposit, but typically admin does.
     * @param _amount Amount of FRED to deposit
     */
    function depositFredForPayouts(uint256 _amount) external {
        fredToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Withdraw excess FRED from contract (admin only).
     * @param _amount Amount to withdraw
     */
    function withdrawExcessFred(uint256 _amount) external onlyAdmin {
        fredToken.safeTransfer(admin, _amount);
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get idea details by ID
     */
    function getIdea(uint256 _ideaId) external view returns (Idea memory) {
        return ideas[_ideaId];
    }

    /**
     * @notice Get all stakers for an idea
     */
    function getIdeaStakers(uint256 _ideaId) external view returns (address[] memory) {
        return ideaStakers[_ideaId];
    }

    /**
     * @notice Get total number of ideas
     */
    function getTotalIdeas() external view returns (uint256) {
        return nextIdeaId - 1;
    }

    /**
     * @notice Check if user can claim from an idea
     */
    function canClaim(uint256 _ideaId, address _user) external view returns (bool) {
        Idea storage idea = ideas[_ideaId];
        return idea.isBuilt && 
               hasStaked[_ideaId][_user] && 
               !hasClaimed[_ideaId][_user] &&
               idea.payoutPool > 0;
    }

    /**
     * @notice Get user's claimable amount for an idea
     */
    function getClaimableAmount(uint256 _ideaId, address _user) external view returns (uint256) {
        Idea storage idea = ideas[_ideaId];
        if (!idea.isBuilt || !hasStaked[_ideaId][_user] || hasClaimed[_ideaId][_user] || idea.payoutPool == 0) {
            return 0;
        }
        return idea.payoutPool / idea.stakerCount;
    }

    /**
     * @notice Get contract's FRED balance
     */
    function getContractBalance() external view returns (uint256) {
        return fredToken.balanceOf(address(this));
    }
}
