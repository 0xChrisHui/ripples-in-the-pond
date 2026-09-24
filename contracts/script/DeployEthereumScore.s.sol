// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EthereumScoreNFT} from "../src/EthereumScoreNFT.sol";

/// 只允许部署到 Sepolia 或 Ethereum；角色和永久 URI 均须显式提供。
contract DeployEthereumScore is Script {
    function run() external returns (EthereumScoreNFT nft) {
        require(block.chainid == 1 || block.chainid == 11155111, "unsupported chain");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("ETH_SCORE_ADMIN_ADDRESS");
        address authorizer = vm.envAddress("ETH_SCORE_AUTHORIZER_ADDRESS");
        address pauser = vm.envAddress("ETH_SCORE_PAUSER_ADDRESS");
        string memory collectionUri = vm.envString("ETH_SCORE_CONTRACT_URI");
        uint48 adminDelay = uint48(vm.envUint("ETH_SCORE_ADMIN_DELAY_SECONDS"));
        address existing = vm.envOr("ETH_SCORE_EXISTING_ADDRESS", address(0));

        // 广播结果未知或重复执行时，显式传既有地址只做读回，不再次部署。
        if (existing != address(0)) {
            require(existing.code.length > 0, "existing address has no code");
            nft = EthereumScoreNFT(existing);
            require(nft.defaultAdmin() == admin, "admin mismatch");
            require(nft.defaultAdminDelay() == adminDelay, "admin delay mismatch");
            require(nft.hasRole(nft.AUTHORIZER_ROLE(), authorizer), "authorizer mismatch");
            require(nft.hasRole(nft.PAUSER_ROLE(), pauser), "pauser mismatch");
            require(keccak256(bytes(nft.contractURI())) == keccak256(bytes(collectionUri)), "contract URI mismatch");
            require(!nft.paused(), "contract paused");
            _log(nft, admin, authorizer, pauser, adminDelay);
            return nft;
        }

        vm.startBroadcast(deployerKey);
        nft = new EthereumScoreNFT(collectionUri, adminDelay, admin, authorizer, pauser);
        vm.stopBroadcast();

        _log(nft, admin, authorizer, pauser, adminDelay);
    }

    function _log(EthereumScoreNFT nft, address admin, address authorizer, address pauser, uint48 adminDelay)
        private
        view
    {
        console.log("EthereumScoreNFT:", address(nft));
        console.log("Chain ID:        ", block.chainid);
        console.log("Admin:           ", admin);
        console.log("Authorizer:      ", authorizer);
        console.log("Pauser:          ", pauser);
        console.log("Admin delay:     ", adminDelay);
        console.log("Contract URI:    ", nft.contractURI());
    }
}
