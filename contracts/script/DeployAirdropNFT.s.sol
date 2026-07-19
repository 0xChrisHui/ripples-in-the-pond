// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AirdropNFT.sol";

/**
 * Phase 6 C2 部署脚本 — AirdropNFT，admin / minter 分离
 *
 * 主网权限模型见 DeployScore.s.sol 注释。
 * 注意：Phase 6 D1 决策 = 主网首版不做空投；该合约保留但 cron 停用。
 *
 * 用法：
 *   cd contracts
 *   forge script script/DeployAirdropNFT.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 */
contract DeployAirdropNFT is Script {
    function run() external {
        // B-0 #9：主网首版不部署 AirdropNFT（省 gas 省面，将来要用再单独部署）；只保留测试网可用
        require(block.chainid != 10, "AirdropNFT: not deployed on mainnet (B-0 #9)");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address minter = vm.envOr("MINTER_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        AirdropNFT nft = new AirdropNFT(
            "Ripples in the Pond Airdrop (Testnet)",
            "RIPA",
            minter
        );

        if (admin != deployer) {
            nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), admin);
            nft.revokeRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
        }

        vm.stopBroadcast();

        console.log("AirdropNFT:", address(nft));
        console.log("Name:      ", nft.name());
        console.log("Symbol:    ", nft.symbol());
        console.log("Deployer:  ", deployer);
        console.log("Admin:     ", admin);
        console.log("Minter:    ", minter);
    }
}
