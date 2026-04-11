// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ScoreNFT.sol";
import "../src/MintOrchestrator.sol";

/**
 * Phase 3 S3.b 部署脚本 — MintOrchestrator + 权限授权 + 端到端验证
 *
 * 三步动作（一笔 broadcast 内完成）：
 * 1. new MintOrchestrator(SCORE_NFT_ADDRESS)
 * 2. ScoreNFT.grantRole(MINTER_ROLE, orchestrator)  ← 关键授权
 * 3. orchestrator.mintScore(deployer)               ← 端到端验证
 *    第 3 步会在 OP Sepolia 真的 mint 一张 ScoreNFT (tokenId 1)
 *
 * 用法：
 * cd contracts
 * SCORE_NFT_ADDRESS=0xA65C... \
 *   forge script script/DeployOrchestrator.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL \
 *     --private-key $OPERATOR_PRIVATE_KEY \
 *     --broadcast -vv
 */
contract DeployOrchestrator is Script {
    function run() external {
        address scoreNftAddr = vm.envAddress("SCORE_NFT_ADDRESS");
        address deployer = msg.sender;

        vm.startBroadcast();

        // Step 1: 部署 Orchestrator
        MintOrchestrator orchestrator = new MintOrchestrator(scoreNftAddr);
        console.log("MintOrchestrator deployed at:", address(orchestrator));

        // Step 2: 把 ScoreNFT 的 MINTER_ROLE 复制给 Orchestrator
        ScoreNFT nft = ScoreNFT(scoreNftAddr);
        bytes32 minterRole = nft.MINTER_ROLE();
        nft.grantRole(minterRole, address(orchestrator));
        console.log("Granted MINTER_ROLE to Orchestrator on ScoreNFT");

        // Step 3: 端到端验证 — 真的 mint 一张到 deployer
        uint256 tokenId = orchestrator.mintScore(deployer);
        console.log("End-to-end mint OK, tokenId:", tokenId);
        console.log("Owner of tokenId:", nft.ownerOf(tokenId));

        vm.stopBroadcast();
    }
}
