// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AirdropNFT.sol";

/**
 * Phase 4 S6 部署脚本 — AirdropNFT 到 OP Sepolia
 *
 * deployer = operator，同时拿 DEFAULT_ADMIN_ROLE + MINTER_ROLE
 * 空投由 cron 直接调 AirdropNFT.mint()，不走 Orchestrator
 *
 * 用法（在 contracts/ 目录下）：
 * forge script script/DeployAirdropNFT.s.sol \
 *   --rpc-url %ALCHEMY_RPC_URL% \
 *   --private-key %OPERATOR_PRIVATE_KEY% \
 *   --broadcast -vv
 */
contract DeployAirdropNFT is Script {
    function run() external {
        // 💭 为什么不用 msg.sender：broadcast 前 msg.sender 是 Foundry 默认地址，不是私钥地址
        uint256 deployerKey = vm.envUint("OPERATOR_PRIVATE_KEY");
        address minter = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        AirdropNFT nft = new AirdropNFT(
            "Ripples in the Pond Airdrop (Testnet)",
            "RIPA",
            minter
        );

        console.log("AirdropNFT deployed at:", address(nft));
        console.log("Name:  ", nft.name());
        console.log("Symbol:", nft.symbol());
        console.log("Minter:", minter);

        vm.stopBroadcast();
    }
}
