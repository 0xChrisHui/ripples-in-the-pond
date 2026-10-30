// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PondSoundNFT} from "../src/p22/PondSoundNFT.sol";
import {PondTrackNFT} from "../src/p22/PondTrackNFT.sol";
import {ScorePackOpener} from "../src/p22/ScorePackOpener.sol";

/// 部署后读真链核对（只读，不广播）：绑定关系、角色、TBA 依赖、暂停状态。
/// 用法：forge script script/VerifyScorePack.s.sol --rpc-url <链>，环境变量见 run()。
contract VerifyScorePack is Script {
    address internal constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address internal constant ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;

    function run() external view {
        ScorePackOpener opener = ScorePackOpener(vm.envAddress("P22_OPENER_ADDRESS"));
        PondSoundNFT sounds = PondSoundNFT(vm.envAddress("P22_SOUNDS_ADDRESS"));
        PondTrackNFT tracks = PondTrackNFT(vm.envAddress("P22_TRACKS_ADDRESS"));
        address admin = vm.envAddress("P22_ADMIN_ADDRESS");
        address signer = vm.envAddress("P22_SIGNER_ADDRESS");
        address pauser = vm.envAddress("P22_PAUSER_ADDRESS");
        address score = vm.envAddress("P22_SCORE_ADDRESS");
        address deployer = vm.envOr("P22_DEPLOYER_ADDRESS", address(0));

        require(address(opener).code.length > 0, "opener no code");
        require(address(sounds).code.length > 0 && address(tracks).code.length > 0, "asset no code");
        require(address(opener.score()) == score, "score binding");
        require(address(opener.sounds()) == address(sounds), "sounds binding");
        require(address(opener.tracks()) == address(tracks), "tracks binding");
        require(sounds.opener() == address(opener) && tracks.opener() == address(opener), "opener binding");
        require(address(opener.registry()) == REGISTRY, "registry binding");
        require(opener.accountImplementation() == ACCOUNT_IMPL, "implementation binding");
        require(opener.defaultAdmin() == admin, "opener admin");
        require(sounds.defaultAdmin() == admin && tracks.defaultAdmin() == admin, "asset admin");
        require(opener.hasRole(opener.SIGNER_ROLE(), signer), "signer");
        require(!opener.hasRole(opener.SIGNER_ROLE(), admin), "admin is signer");
        require(!opener.hasRole(opener.SIGNER_ROLE(), pauser), "pauser is signer");
        require(opener.hasRole(opener.PAUSER_ROLE(), pauser), "opener pauser");
        require(sounds.hasRole(sounds.PAUSER_ROLE(), pauser), "sounds pauser");
        require(tracks.hasRole(tracks.PAUSER_ROLE(), pauser), "tracks pauser");
        require(!opener.paused() && !sounds.paused() && !tracks.paused(), "paused");
        if (deployer != address(0)) {
            bytes32 adminRole = opener.DEFAULT_ADMIN_ROLE();
            require(!opener.hasRole(adminRole, deployer), "deployer holds opener admin");
            require(!sounds.hasRole(adminRole, deployer), "deployer holds sounds admin");
            require(!tracks.hasRole(adminRole, deployer), "deployer holds tracks admin");
            require(!opener.hasRole(opener.SIGNER_ROLE(), deployer), "deployer holds signer");
            require(!opener.hasRole(opener.PAUSER_ROLE(), deployer), "deployer holds pauser");
        }
        console.log("P22 deployment verified on chain", block.chainid);
    }
}
