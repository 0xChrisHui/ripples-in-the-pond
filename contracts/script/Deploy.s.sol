// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployBase.s.sol";
import "../src/MaterialNFT.sol";

/**
 * Phase 6 C2 部署脚本 — MaterialNFT，admin / minter 分离
 *
 * 主网权限模型见 DeployScore.s.sol 注释。测试网兼容：env 缺省时回退 deployer。
 *
 * 用法：
 *   cd contracts
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 */
contract Deploy is DeployBase {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        // CT-2/CT-3：主网强制 admin/minter 显式且互不相同、都 ≠ deployer（红线在 _resolveRoles）
        (address admin, address minter) = _resolveRoles(deployer);
        // CT-15：初始 URI 参数化。部署后 admin setURI 到最终 Arweave 再 freezeURI（MaterialNFT CT-8）
        string memory materialUri = vm.envOr("MATERIAL_URI", string("https://placeholder.ripples/{id}.json"));

        vm.startBroadcast(deployerKey);

        MaterialNFT nft = new MaterialNFT(materialUri, minter);

        // CT-3：移交 DEFAULT_ADMIN_ROLE（先 grant 链上验成功、再 revoke deployer）
        _handoverAdmin(address(nft), deployer, admin);

        vm.stopBroadcast();

        console.log("MaterialNFT:", address(nft));
        console.log("Deployer:   ", deployer);
        console.log("Admin:      ", admin);
        console.log("Minter:     ", minter);
    }
}
