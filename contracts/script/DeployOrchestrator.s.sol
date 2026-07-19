// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployBase.s.sol";
import "../src/ScoreNFT.sol";
import "../src/MintOrchestrator.sol";

/**
 * Phase 6 C2 + C3 部署脚本 — MintOrchestrator
 *
 * 改动（vs Phase 3 S3.b）：
 *   - 删除"端到端 mint(deployer)"测试 mint（C3 拆到 TestMintOrchestrator.s.sol）
 *     原因：主网照跑 = 合集 tokenId 1 永久无 metadata
 *   - admin / minter 参数化（C2，env 缺省回退 deployer）
 *   - ScoreNFT.grantRole 仅在 deployer 仍持有 ScoreNFT.DEFAULT_ADMIN_ROLE 时执行；
 *     主网模式下 admin 已在 ScoreNFT 部署阶段移交，本步骤会 log 提示由 admin 手动调
 *
 * 用法：
 *   cd contracts
 *   SCORE_NFT_ADDRESS=0x... \
 *     forge script script/DeployOrchestrator.s.sol \
 *       --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 *
 * 主网 admin 手动授权命令见 docs/MAINNET-RUNBOOK.md。
 */
contract DeployOrchestrator is DeployBase {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        // CT-2/CT-3：主网强制 admin/minter 显式且互不相同、都 ≠ deployer（红线在 _resolveRoles）
        (address admin, address minter) = _resolveRoles(deployer);
        address scoreNftAddr = vm.envAddress("SCORE_NFT_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. 部署 Orchestrator（构造函数把 deployer 设为 admin + minter）
        MintOrchestrator orchestrator = new MintOrchestrator(scoreNftAddr);
        console.log("MintOrchestrator:", address(orchestrator));

        // 2. 修正 Orchestrator 自身的 admin / minter
        //    minter：先 grant 链上验成功再 revoke deployer（避免 grant 未生效却弃权 → 铸造全断）
        if (minter != deployer) {
            bytes32 mRole = orchestrator.MINTER_ROLE();
            orchestrator.grantRole(mRole, minter);
            require(orchestrator.hasRole(mRole, minter), "grant minter failed");
            orchestrator.revokeRole(mRole, deployer);
        }
        // CT-3：admin 移交走共享安全护栏（先 grant 验成功再 revoke deployer）
        _handoverAdmin(address(orchestrator), deployer, admin);

        // 3. 把 ScoreNFT 的 MINTER_ROLE 授权给 Orchestrator
        //    注意：需要 deployer 仍持有 ScoreNFT.DEFAULT_ADMIN_ROLE
        ScoreNFT scoreNft = ScoreNFT(scoreNftAddr);
        bytes32 nftMinter = scoreNft.MINTER_ROLE();
        if (scoreNft.hasRole(scoreNft.DEFAULT_ADMIN_ROLE(), deployer)) {
            scoreNft.grantRole(nftMinter, address(orchestrator));
            console.log("Granted ScoreNFT.MINTER_ROLE to Orchestrator");
        } else {
            console.log("[!] deployer lacks ScoreNFT.DEFAULT_ADMIN_ROLE");
            console.log("    admin must run: cast send <ScoreNFT> 'grantRole(bytes32,address)' <MINTER_ROLE> <Orchestrator>");
        }

        vm.stopBroadcast();

        console.log("Deployer:", deployer);
        console.log("Admin:   ", admin);
        console.log("Minter:  ", minter);
    }
}
