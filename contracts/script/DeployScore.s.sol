// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployBase.s.sol";
import "../src/ScoreNFT.sol";

/**
 * Phase 6 C2 部署脚本 — ScoreNFT，admin / minter 分离
 *
 * 主网权限模型（D-C1）：
 *   ADMIN_ADDRESS  = 冷钱包（DEFAULT_ADMIN_ROLE）
 *   MINTER_ADDRESS = 运营热钱包（MINTER_ROLE）
 *   deployer = DEPLOYER_PRIVATE_KEY 派生地址，部署后 revoke 多余角色
 *
 * 测试网兼容：ADMIN_ADDRESS / MINTER_ADDRESS 留空时
 *   自动回退到 deployer = admin = minter（vm.envOr）
 *
 * 用法：
 *   cd contracts
 *   forge script script/DeployScore.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 *
 * 详细 runbook：docs/MAINNET-RUNBOOK.md
 */
contract DeployScore is DeployBase {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        // CT-2/CT-3：主网强制 admin/minter 显式且互不相同、都 ≠ deployer（红线在 _resolveRoles）
        (address admin, address minter) = _resolveRoles(deployer);

        // CT-1：name/symbol 参数化。ERC721 name 部署后永久不可改，主网（chainid 10）
        // 必须显式提供 SCORE_NFT_NAME / SCORE_NFT_SYMBOL，缺失即 revert——
        // 防止把 "(Testnet)" 或占位名永久焊进主网合约。主网值取 B-0 #7：Ripples in the Pond / RPIP。
        // 测试网留空则回退带 (Testnet) 的名字，零配置照旧。
        bool isMainnet = block.chainid == 10;
        string memory nftName = isMainnet
            ? vm.envString("SCORE_NFT_NAME")
            : vm.envOr("SCORE_NFT_NAME", string("Ripples in the Pond Score (Testnet)"));
        string memory nftSymbol = isMainnet
            ? vm.envString("SCORE_NFT_SYMBOL")
            : vm.envOr("SCORE_NFT_SYMBOL", string("RIPS"));

        vm.startBroadcast(deployerKey);

        ScoreNFT nft = new ScoreNFT(nftName, nftSymbol, minter);

        // CT-3：移交 DEFAULT_ADMIN_ROLE（先 grant 链上验成功、再 revoke deployer）
        _handoverAdmin(address(nft), deployer, admin);
        // 💭 minter 已在构造函数 _grantRole；deployer 默认无 MINTER_ROLE 不用 revoke

        vm.stopBroadcast();

        console.log("ScoreNFT:", address(nft));
        console.log("Name:    ", nft.name());
        console.log("Symbol:  ", nft.symbol());
        console.log("Deployer:", deployer);
        console.log("Admin:   ", admin);
        console.log("Minter:  ", minter);
    }
}
