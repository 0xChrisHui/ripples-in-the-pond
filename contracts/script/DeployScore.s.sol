// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ScoreNFT.sol";

/**
 * Phase 3 S2.b 部署脚本 — ScoreNFT 到 OP Sepolia
 *
 * deployer = msg.sender = operator（签名用 OPERATOR_PRIVATE_KEY）
 * deployer 自动获得 DEFAULT_ADMIN_ROLE + MINTER_ROLE（构造函数里）
 * S3 部署 MintOrchestrator 后再 grantRole(MINTER_ROLE, orchestrator)
 *
 * 用法：
 * cd contracts
 * forge script script/DeployScore.s.sol \
 *   --rpc-url $ALCHEMY_RPC_URL \
 *   --private-key $OPERATOR_PRIVATE_KEY \
 *   --broadcast -vv
 */
contract DeployScore is Script {
    function run() external {
        address minter = msg.sender;

        vm.startBroadcast();

        ScoreNFT nft = new ScoreNFT(
            "Ripples in the Pond Score (Testnet)",
            "RIPS",
            minter
        );

        console.log("ScoreNFT deployed at:", address(nft));
        console.log("Name:  ", nft.name());
        console.log("Symbol:", nft.symbol());
        console.log("Minter (MINTER_ROLE):", minter);

        vm.stopBroadcast();
    }
}
