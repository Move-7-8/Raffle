const { network, ethers} = require("hardhat");
const {developmentChains, networkConfig} = require("../helper-hardhat-config");
const {verify} = require("../utils/verify");   
const VRF_SUB_FUND_AMOUNT = ethers.parseEther("2")  

module.exports = async function ({ getNamedAccounts, deployments }) {
  
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId
    console.log("Chain ID:", chainId);

    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address);
    console.log("VRF Coordinator Mock Address:", vrfCoordinatorV2Mock.target);
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait()
    const subscriptionCreatedEventSignature = ethers.id("SubscriptionCreated(uint64,address)");
    const subscriptionCreatedEvent = transactionReceipt.logs.find(
        (log) => log.topics[0] === subscriptionCreatedEventSignature
    );
      
// After extracting the subscription ID
if (subscriptionCreatedEvent) {
    const decodedEvent = vrfCoordinatorV2Mock.interface.decodeEventLog(
        "SubscriptionCreated",
        subscriptionCreatedEvent.data,
        subscriptionCreatedEvent.topics
    );

    // Access the subscription ID
    const subscriptionID = decodedEvent.subId;
    subscriptionId = subscriptionID;  // No need to convert it
} else {
    console.log("SubscriptionCreated event not found in the transaction receipt");
}

// Fund the subscription with the correct BigInt value
await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);

    } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval]
    
    const raffle = await deploy('Raffle', {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", vrfCoordinatorV2Address);
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    }



    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying contract on Etherscan...")
        await verify(raffle.address, args)
    }
    log("-----------------------------------")
}

module.exports.tags = ["All", "Raffle"]   