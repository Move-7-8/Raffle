// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

//Imports 
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

//Errors
error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed(); 
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);
error Raffle__NotOpen();

/**
* @title Raffle Contract
* @author Connor
* @notice This contract is a lottery contract that uses Chainlink VRF to pick a random winner
*/

contract Raffle is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {

    //Type Declarations 
    enum RaffleState {
        OPEN,
        CALCULATING
    } 

    //State Variables 
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint256 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    //Lottery Variables
    address private s_recentWinner;
    uint256 private s_isOpen;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    //Events 
    event RaffleEnter (address indexed player);
    event RequestedRaffleWinner (uint256 requestId);
    event WinnerPicked (address indexed winner); 

    //Functions
    constructor(
        address vrfCoordinatorV2, 
        uint256 entranceFee,
        bytes32 gasLane, 
        uint256 subscriptionId, 
        uint32 callbackGasLimit,
        uint256 interval 
    ) VRFConsumerBaseV2Plus(vrfCoordinatorV2)  {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;    
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if(msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen(); 
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
    * @dev This is the function that the Chainlink Keeper nodes call
    * they look for the 'upkeepNeeded' to be return True 
    * the following should be true in order to return True 
    * 1. Our time interval should have passed 
    * 2. The lotto should have at least 1 player, and have some ETH
    * 3. Our subscription is funded with LINK 
    * 4. The lottery should be in an open state
    */
    // Add override
    function checkUpkeep(
        bytes memory /* checkData */
        ) 
        public 
        view
        override 
        returns (
            bool upkeepNeeded, 
            bytes memory /* performData */) 
        {
        bool isOpen = (RaffleState.OPEN == s_raffleState);  
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        }

    // Request Random Winner
    function performUpkeep(
        bytes calldata /* performData*/
        ) external override
        {
        (bool upkeepNeeded,) = checkUpkeep("");
        if(!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_gasLane,
                subId: i_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))  // Set nativePayment as true if you want to pay in native tokens, otherwise set false for LINK payments
            })
        );
        emit RequestedRaffleWinner(requestId);
    }

    // Add override
        function fulfillRandomWords(
            uint256 requestId, 
            uint256[] calldata randomWords  // Change to calldata
        ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        // (, bytes memory data) = address(this).staticcall(abi.encodeWithSignature("getEntranceFee()"));
        (bool success, ) = recentWinner.call{value: address(this).balance}(""); 
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    // Getter Functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint16) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

}