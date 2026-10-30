// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase} from "./PackTestBase.sol";
import {DeployScorePack} from "../../script/DeployScorePack.s.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";

contract DeployScorePackTest is PackTestBase {
    uint256 internal constant DEPLOYER_KEY = 0xDEADBEEF;
    address internal constant OP_SCORE = 0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA;
    address internal constant ETH_SCORE = 0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A;

    uint256 internal seed;

    /// 每次取一把全新钱包（nonce 为 0），模拟主网的一次性部署钱包。
    function _cfg() internal returns (DeployScorePack.Config memory c) {
        c.key = DEPLOYER_KEY + (++seed);
        c.deployer = vm.addr(c.key);
        c.score = address(score);
        c.admin = admin;
        c.signer = signer;
        c.pauser = pauser;
        c.operator = address(0x0BE12A70);
        c.soundUri = AR;
        c.trackUri = AR;
        c.delay = 1 days;
    }

    /// 主网 Score 地址写死：把 mock 字节码放到固定地址，部署者重置为全新钱包。
    function _mainnet(uint256 chainId) internal returns (DeployScorePack.Config memory c) {
        c = _cfg();
        address pinned = chainId == 10 ? OP_SCORE : ETH_SCORE;
        vm.etch(pinned, address(score).code);
        c.score = pinned;
        vm.chainId(chainId);
    }

    function test_deployOnBothMainnetsAndTestnets() public {
        uint256[4] memory chains = [uint256(1), 10, 11155111, 11155420];
        for (uint256 i = 0; i < 4; ++i) {
            bool main = chains[i] == 1 || chains[i] == 10;
            DeployScorePack.Config memory c = main ? _mainnet(chains[i]) : _cfg();
            vm.chainId(chains[i]);
            (ScorePackOpener o,,) = new DeployScorePack().execute(c);
            assertEq(o.defaultAdmin(), admin);
            assertTrue(o.hasRole(o.SIGNER_ROLE(), signer));
            assertFalse(o.hasRole(o.SIGNER_ROLE(), admin));
        }
    }

    function test_rejectsAdminAsSignerOnEthereumMainnet() public {
        DeployScorePack.Config memory c = _mainnet(1);
        c.signer = admin;
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("roles must differ");
        d.execute(c);
    }

    function test_rejectsDeployerHoldingRole() public {
        DeployScorePack.Config memory c = _mainnet(1);
        c.pauser = c.deployer;
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("deployer must hold no role");
        d.execute(c);
    }

    function test_rejectsShortDelayOnMainnetsOnly() public {
        DeployScorePack d = new DeployScorePack();
        DeployScorePack.Config memory c = _mainnet(10);
        c.delay = 60;
        vm.expectRevert("admin delay too short");
        d.execute(c);
        c = _mainnet(1);
        c.delay = 60;
        vm.expectRevert("admin delay too short");
        d.execute(c);
        c = _cfg();
        c.delay = 60;
        vm.chainId(11155420);
        d.execute(c); // 测试网放行
    }

    function test_rejectsWrongRegistryCode() public {
        DeployScorePack.Config memory c = _mainnet(10);
        vm.etch(REGISTRY, hex"00");
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("registry code mismatch");
        d.execute(c);
    }

    function test_rejectsUnsupportedChain() public {
        vm.chainId(8453);
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("unsupported chain");
        d.execute(_cfg());
    }

    function test_rejectsWrongScoreAddressOnMainnets() public {
        DeployScorePack d = new DeployScorePack();
        DeployScorePack.Config memory c = _mainnet(10);
        c.score = address(score); // 不是写死的 OP 主网 Score
        vm.expectRevert("score address mismatch");
        d.execute(c);
        c = _mainnet(1);
        c.score = OP_SCORE; // OP 的地址填到以太坊主网
        vm.expectRevert("score address mismatch");
        d.execute(c);
    }

    function test_mainnetNeedsFreshDeployerAndSeparateOperator() public {
        DeployScorePack d = new DeployScorePack();
        DeployScorePack.Config memory c = _mainnet(1);
        vm.setNonce(c.deployer, 5); // 已用过的钱包
        vm.expectRevert("deployer must be a fresh wallet");
        d.execute(c);

        c = _mainnet(1);
        c.operator = signer;
        vm.expectRevert("operator must differ");
        d.execute(c);

        c = _mainnet(10);
        c.operator = address(0);
        vm.expectRevert("operator required on mainnet");
        d.execute(c);

        c = _mainnet(10);
        c.operator = c.deployer;
        vm.expectRevert("deployer must not be the operator wallet");
        d.execute(c);
    }

    function test_rejectsDeployerKeyMismatch() public {
        DeployScorePack d = new DeployScorePack();
        DeployScorePack.Config memory c = _mainnet(1);
        c.deployer = address(0x1234); // 与 key 对不上
        vm.expectRevert("deployer must match key");
        d.execute(c);
    }
}
