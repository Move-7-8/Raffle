const { assert, expect } = require("chai");
const hardhat = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config.js");

const { network, deployments, ethers, getNamedAccounts } = hardhat;

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
        const chainId = network.config.chainId;
                beforeEach(async () => {
            const { deployer } = await getNamedAccounts()
            accounts = await ethers.getSigners();
            await deployments.fixture(["All"]) 
            raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address);
            vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address);
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", function () {
            it("initializes the raffle correctly", async () => {
                // Ideally separate these out so that only 1 assert per "it" block
                // And ideally, we'd make this check everything
                const raffleState = (await raffle.getRaffleState()).toString()
                const interval = await raffle.getInterval()
                assert.equal(raffleState.toString(0), "0")
                assert.equal(
                    interval.toString(),
                    networkConfig[network.config.chainId]["interval"]
                )
            })
        })

        describe("enterRaffle", function () {
            it("reverts when you don't pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughEthEntered")
            })
            it("records player when they enter", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const contractPlayer = await raffle.getPlayers(0)
                assert.equal(contractPlayer.address, deployer)
            })
            it("emits event on enter", async () => {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit( // emits RaffleEnter event if entered to index player(s) address
                    raffle,
                    "RaffleEnter"
                )
            })
            it("doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])

                await network.provider.request({ method: "evm_mine", params: [] })
                // we pretend to be a keeper for a second
                await raffle.performUpkeep("0x") // changes the state to calculating for our comparison below
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError( // is reverted as raffle is calculating
                    raffle, "Raffle__NotOpen"
                )
            })
        })

        describe("checkUpkeep", function () {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                assert(!upkeepNeeded)
            })
            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep("0x") // changes the state to calculating
                const raffleState = await raffle.getRaffleState() // stores the new state
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            })
            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval)  - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval)  + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                assert(upkeepNeeded)
            })
            })

        describe("performUpkeep", function () {
            it("can only run if checkupkeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval)   + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep("0x") 
                assert(tx)
            })
            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError( 
                    raffle, "Raffle__UpkeepNotNeeded"
                )
            })
            it("updates the raffle state and emits a requestId", async () => {
                // Too many asserts in this test!
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep("0x"); // emits requestId
                const txReceipt = await txResponse.wait(1); // waits 1 block
                const event = txReceipt.logs.find((log) => log.topics[0] === ethers.id("RequestedRaffleWinner(uint256)"));
        
                //   const event = txReceipt.events[0]; // Use the correct index or find logic
                const requestId = event.args.requestId; // Access the requestId
                assert(Number(requestId) > 0); // Use Number() to convert and check if it's greater than 0
                const raffleState = await raffle.getRaffleState(); // Check state
                assert.equal(raffleState, 1); // 0 = open, 1 = calculating
                            })
        })

        describe("fulfillRandomWords", function () {
            beforeEach(async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval)  + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            it("can only be called after performupkeep", async () => {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")
            })

            // This test is too big...
            // This test simulates users entering the raffle and wraps the entire functionality of the raffle
            // inside a promise that will resolve if everything is successful.
            // An event listener for the WinnerPicked is set up
            // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
            // All the assertions are done once the WinnerPicked event is fired
            it("picks a winner, resets, and sends money", async () => {
                const additionalEntrances = 3 // to test
                const startingIndex = 2
                let startingBalance
                for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
                    raffle = raffle.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimeStamp = await raffle.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => { // event listener for WinnerPicked
                        console.log("WinnerPicked event fired!")
                        // assert throws an error if it fails, so need to wrap
                        // it in a try/catch so that the promise returns event
                        // if it fails.
                        try {
                            // Now lets get the ending values...
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerBalance = await ethers.provider.getBalance(accounts[2].address);

                            const endingBalance = BigInt(winnerBalance) + 
                                                  BigInt(raffleEntranceFee) * BigInt(additionalEntrances) + 
                                                  BigInt(raffleEntranceFee);            
                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            await expect(raffle.getPlayers(0)).to.be.reverted
                            // Comparisons to check if our ending values are correct:
                            assert.equal(recentWinner.toString(), accounts[2].address)
                            assert.equal(raffleState.toString(), "0")
                            assert.equal(
                                winnerBalance.toString(),
                                endingBalance.toString()
                            );
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve() // if try passes, resolves the promise 
                        } catch (e) { 
                            reject(e) // if try fails, rejects the promise
                        }
                    })

                    // kicking off the event by mocking the chainlink keepers and vrf coordinator
                    try {
                        const tx = await raffle.performUpkeep("0x")
                        const txReceipt = await tx.wait(1)
                        const event = txReceipt.logs.find((log) => log.topics[0] === ethers.id("RequestedRaffleWinner(uint256)"));
                        const requestId = event.args.requestId;

                        startingBalance = await ethers.provider.getBalance(accounts[2].address);
                        await vrfCoordinatorV2Mock.fulfillRandomWords(
                            requestId,
                            // txReceipt.events[1].args.requestId,
                            raffle.target
                      )
                    } catch (e) {
                        reject(e)
                    }
                })
            })
        })
    })