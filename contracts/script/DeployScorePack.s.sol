// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PondSoundNFT} from "../src/p22/PondSoundNFT.sol";
import {PondTrackNFT} from "../src/p22/PondTrackNFT.sol";
import {ScorePackOpener} from "../src/p22/ScorePackOpener.sol";

/// P22 资产包部署：OP / ETH 主网与两条测试网。两条主网都强制角色隔离（DeployBase 只覆盖 chainid 10，故这里独立实现）。
/// 素材合约需要 opener 地址，用 deployer nonce 预测；部署后读回全部角色，deployer 不持有任何角色。
contract DeployScorePack is Script {
    address internal constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address internal constant ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    bytes32 internal constant REGISTRY_HASH = 0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735;
    bytes32 internal constant ACCOUNT_HASH = 0xdf5eeb80b53e48dfd667fff5264976de4004fdd27eef4f6b954d182109f0f85b;

    /// 主网 Score 合约写死：环境变量填错不能让三个合约永久绑错。
    address internal constant OP_MAINNET_SCORE = 0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA;
    address internal constant ETH_MAINNET_SCORE = 0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A;

    struct Config {
        uint256 key;
        address deployer;
        address score;
        address admin;
        address signer;
        address pauser;
        /// OP 代付提交者（运营热钱包）：主网必填，且不得等于 signer / admin / pauser
        address operator;
        string soundUri;
        string trackUri;
        uint48 delay;
    }

    function run() external returns (ScorePackOpener, PondSoundNFT, PondTrackNFT) {
        return execute(_load());
    }

    /// 与环境变量解耦的入口，便于确定性测试。
    function execute(Config memory c)
        public
        returns (ScorePackOpener opener, PondSoundNFT sounds, PondTrackNFT tracks)
    {
        uint256 id = block.chainid;
        require(id == 1 || id == 10 || id == 11155111 || id == 11155420, "unsupported chain");
        _precheck(c, id == 1 || id == 10);

        address predicted = vm.computeCreateAddress(c.deployer, vm.getNonce(c.deployer) + 2);
        vm.startBroadcast(c.key);
        sounds = new PondSoundNFT(c.soundUri, predicted, c.admin, c.pauser, c.delay);
        tracks = new PondTrackNFT(c.trackUri, predicted, c.admin, c.pauser, c.delay);
        opener = new ScorePackOpener(
            c.score, address(sounds), address(tracks), REGISTRY, ACCOUNT_IMPL, c.admin, c.signer, c.pauser, c.delay
        );
        vm.stopBroadcast();

        require(address(opener) == predicted, "opener address mismatch");
        _verify(opener, sounds, tracks, c);
        console.log("PondSoundNFT:   ", address(sounds));
        console.log("PondTrackNFT:   ", address(tracks));
        console.log("ScorePackOpener:", address(opener));
        console.log("Chain ID:       ", id);
    }

    function _load() internal view returns (Config memory c) {
        c.key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        c.deployer = vm.addr(c.key);
        c.score = vm.envAddress("P22_SCORE_ADDRESS");
        c.admin = vm.envAddress("P22_ADMIN_ADDRESS");
        c.signer = vm.envAddress("P22_SIGNER_ADDRESS");
        c.pauser = vm.envAddress("P22_PAUSER_ADDRESS");
        c.operator = vm.envOr("P22_OPERATOR_ADDRESS", address(0));
        c.soundUri = vm.envString("P22_SOUND_CONTRACT_URI");
        c.trackUri = vm.envString("P22_TRACK_CONTRACT_URI");
        c.delay = uint48(vm.envUint("P22_ADMIN_DELAY_SECONDS"));
    }

    /// 两类网络都校验非零、互异、deployer 不担任角色；主网额外要求 admin 延迟 >= 1 天。
    function _precheck(Config memory c, bool mainnet) internal view {
        // 预测的开包合约地址基于 deployer、实际广播用 key：两者必须是同一个钱包，否则地址预测会错位
        require(c.deployer == vm.addr(c.key), "deployer must match key");
        require(c.admin != address(0) && c.signer != address(0) && c.pauser != address(0), "zero role");
        require(c.admin != c.signer && c.admin != c.pauser && c.signer != c.pauser, "roles must differ");
        require(
            c.deployer != c.admin && c.deployer != c.signer && c.deployer != c.pauser, "deployer must hold no role"
        );
        if (c.operator != address(0)) {
            require(c.operator != c.signer && c.operator != c.admin && c.operator != c.pauser, "operator must differ");
        }
        if (mainnet) {
            require(c.operator != address(0), "operator required on mainnet");
            require(c.deployer != c.operator, "deployer must not be the operator wallet");
            require(c.score == (block.chainid == 10 ? OP_MAINNET_SCORE : ETH_MAINNET_SCORE), "score address mismatch");
            // 一次性部署钱包：nonce 必须为 0，开包合约地址的预测才不会被其他交易打乱
            require(vm.getNonce(c.deployer) == 0, "deployer must be a fresh wallet");
        }
        require(REGISTRY.codehash == REGISTRY_HASH, "registry code mismatch");
        require(ACCOUNT_IMPL.codehash == ACCOUNT_HASH, "account impl code mismatch");
        require(c.score.code.length > 0, "score has no code");
        if (mainnet) require(c.delay >= 1 days, "admin delay too short");
    }

    function _verify(ScorePackOpener opener, PondSoundNFT sounds, PondTrackNFT tracks, Config memory c)
        internal
        view
    {
        require(opener.defaultAdmin() == c.admin, "opener admin");
        require(sounds.defaultAdmin() == c.admin && tracks.defaultAdmin() == c.admin, "asset admin");
        require(opener.hasRole(opener.SIGNER_ROLE(), c.signer), "signer role");
        require(opener.hasRole(opener.PAUSER_ROLE(), c.pauser), "opener pauser");
        require(
            sounds.hasRole(sounds.PAUSER_ROLE(), c.pauser) && tracks.hasRole(tracks.PAUSER_ROLE(), c.pauser),
            "asset pauser"
        );
        require(!opener.hasRole(opener.SIGNER_ROLE(), c.admin), "admin must not sign");
        require(!opener.hasRole(opener.SIGNER_ROLE(), c.deployer), "deployer holds signer");
        require(!opener.hasRole(opener.DEFAULT_ADMIN_ROLE(), c.deployer), "deployer holds admin");
        require(!sounds.hasRole(sounds.DEFAULT_ADMIN_ROLE(), c.deployer), "deployer holds sound admin");
        require(!tracks.hasRole(tracks.DEFAULT_ADMIN_ROLE(), c.deployer), "deployer holds track admin");
        require(sounds.opener() == address(opener) && tracks.opener() == address(opener), "opener binding");
    }
}
