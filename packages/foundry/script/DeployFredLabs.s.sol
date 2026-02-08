// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/FredLabs.sol";

contract DeployFredLabs is Script {
    // $FRED token on Base
    address constant FRED_TOKEN = 0xCCF66470A962464CFF146b34a7cC8c235b068B07;
    // Admin address (clawfred.eth)
    address constant ADMIN = 0x1ddd084e09f4fae7f6b872d0481830bee99b1dfe;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        FredLabs fredLabs = new FredLabs(FRED_TOKEN, ADMIN);
        
        console.log("FredLabs deployed at:", address(fredLabs));
        console.log("FRED Token:", FRED_TOKEN);
        console.log("Admin:", ADMIN);
        
        vm.stopBroadcast();
    }
}
