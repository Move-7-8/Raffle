const { ethers } = require("ethers");

const networkConfig = {
    11155111: {
        name: "Sepolia",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: ethers.parseEther("0.1"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "105746269511529522146930983309861459793927722570206249827485400847282007229923",
        callbackGasLimit: "500000",
        interval: "30",
    }, 
    1337: {
        name: "Hardhat",
        entranceFee: ethers.parseEther("0.1"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        interval: "30",
    }   
}

const  developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains
}