// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MintOrchestrator.sol";
import "../src/ScoreNFT.sol";

/**
 * Phase 6 C3 — 测试网手动跑的"端到端验证 mint"
 *
 * 从 DeployOrchestrator 拆出来：
 *   主网照跑 mintScore(deployer) = 合集 tokenId 1 永久无 metadata
 *   所以验证 mint 改成独立脚本，**只在测试网手动跑**，主网绝不调
 *
 * 前置：DeployOrchestrator 已部署 + admin 已 grantRole MINTER_ROLE 给 Orchestrator
 *      签名钱包必须持有 Orchestrator.MINTER_ROLE（测试网通常 = deployer = minter）
 *
 * 用法（测试网）：
 *   cd contracts
 *   forge script script/TestMintOrchestrator.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 */
contract TestMintOrchestrator is Script {
    function run() external {
        // CT-12：主网护栏——这枚测试 mint 会留下一枚永久无 metadata 的藏品，主网绝不允许
        require(block.chainid != 10, "TestMint: mainnet forbidden (CT-12)");
        uint256 minterKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address minter = vm.addr(minterKey);
        address orchestratorAddr = vm.envAddress("NEXT_PUBLIC_ORCHESTRATOR_ADDRESS");
        address scoreNftAddr = vm.envAddress("NEXT_PUBLIC_SCORE_NFT_ADDRESS");

        // CT-4：orderId 幂等参数。测试 mint 用时变 orderId，重复跑不会撞 "orderId used"
        bytes32 orderId = keccak256(abi.encodePacked("testmint", block.timestamp, minter));
        vm.startBroadcast(minterKey);
        uint256 tokenId = MintOrchestrator(orchestratorAddr).mintScore(minter, orderId);
        vm.stopBroadcast();

        console.log("Test mint OK, tokenId:", tokenId);
        console.log("Owner:", ScoreNFT(scoreNftAddr).ownerOf(tokenId));
    }
}
