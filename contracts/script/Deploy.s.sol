// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";

/**
 * Phase 0 部署脚本 — 用 OZ 现成的 ERC1155PresetMinterPauser
 * 部署后 deployer 自动拥有 DEFAULT_ADMIN_ROLE + MINTER_ROLE
 *
 * 用法：
 * forge script script/Deploy.s.sol --rpc-url $ALCHEMY_RPC_URL \
 *   --private-key $OPERATOR_PRIVATE_KEY --broadcast -vv
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // URI 占位，Phase 1 再换成真实的 Arweave 元数据地址
        ERC1155PresetMinterPauser nft = new ERC1155PresetMinterPauser(
            "https://placeholder.ripples/{id}.json"
        );

        console.log("MaterialNFT deployed at:", address(nft));

        vm.stopBroadcast();
    }
}
