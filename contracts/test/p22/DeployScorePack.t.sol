// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase} from "./PackTestBase.sol";
import {DeployScorePack} from "../../script/DeployScorePack.s.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";

contract DeployScorePackTest is PackTestBase {
    uint256 internal constant DEPLOYER_KEY = 0xDEADBEEF;

    function _cfg() internal view returns (DeployScorePack.Config memory c) {
        c.key = DEPLOYER_KEY;
        c.deployer = vm.addr(DEPLOYER_KEY);
        c.score = address(score);
        c.admin = admin;
        c.signer = signer;
        c.pauser = pauser;
        c.soundUri = AR;
        c.trackUri = AR;
        c.delay = 1 days;
    }

    function test_deployOnBothMainnetsAndTestnets() public {
        uint256[4] memory chains = [uint256(1), 10, 11155111, 11155420];
        for (uint256 i = 0; i < 4; ++i) {
            vm.chainId(chains[i]);
            (ScorePackOpener o,,) = new DeployScorePack().execute(_cfg());
            assertEq(o.defaultAdmin(), admin);
            assertTrue(o.hasRole(o.SIGNER_ROLE(), signer));
            assertFalse(o.hasRole(o.SIGNER_ROLE(), admin));
        }
    }

    function test_rejectsAdminAsSignerOnEthereumMainnet() public {
        DeployScorePack.Config memory c = _cfg();
        c.signer = admin;
        vm.chainId(1);
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("roles must differ");
        d.execute(c);
    }

    function test_rejectsDeployerHoldingRole() public {
        DeployScorePack.Config memory c = _cfg();
        c.pauser = c.deployer;
        vm.chainId(1);
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("deployer must hold no role");
        d.execute(c);
    }

    function test_rejectsShortDelayOnMainnetsOnly() public {
        DeployScorePack.Config memory c = _cfg();
        c.delay = 60;
        DeployScorePack d = new DeployScorePack();
        vm.chainId(10);
        vm.expectRevert("admin delay too short");
        d.execute(c);
        vm.chainId(1);
        vm.expectRevert("admin delay too short");
        d.execute(c);
        vm.chainId(11155420);
        d.execute(c); // 测试网放行
    }

    function test_rejectsWrongRegistryCode() public {
        vm.etch(REGISTRY, hex"00");
        vm.chainId(10);
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("registry code mismatch");
        d.execute(_cfg());
    }

    function test_rejectsUnsupportedChain() public {
        vm.chainId(8453);
        DeployScorePack d = new DeployScorePack();
        vm.expectRevert("unsupported chain");
        d.execute(_cfg());
    }
}
