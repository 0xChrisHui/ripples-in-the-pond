// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../script/DeployBase.s.sol";

/// harness：把 internal pure 护栏暴露成 external 以便确定性单测（不碰 env，避开 vm.setEnv 跨测污染）
contract DeployBaseHarness is DeployBase {
    function assertMainnetRoles(address deployer, address admin, address minter) external pure {
        _assertMainnetRoles(deployer, admin, minter);
    }
}

/**
 * DeployBase 测试（CT-2/CT-3）——验证主网角色红线护栏：admin ≠ 铸造热钱包(minter)。
 * 用户 2026-07-19 拍板的永久决策；护栏错=要么留安全洞、要么部署日 revert。
 * 只测纯逻辑 _assertMainnetRoles（确定性）；env 读取 + chainid 分支由部署日测试网回归覆盖。
 */
contract DeployBaseTest is Test {
    DeployBaseHarness h;

    address deployer = address(0xD3);
    address adminW = address(0xA11CE);
    address minterW = address(0xB0B);

    function setUp() public {
        h = new DeployBaseHarness();
    }

    // 合法：三者互不相同、都非零 → 不 revert
    function testAcceptsDistinctRoles() public view {
        h.assertMainnetRoles(deployer, adminW, minterW);
    }

    // 红线：admin == minter（= 热钱包）→ revert
    function testRejectsAdminEqualsMinter() public {
        vm.expectRevert("admin==minter: hot wallet redline");
        h.assertMainnetRoles(deployer, adminW, adminW);
    }

    // admin == deployer（部署后即销毁的钥）→ revert
    function testRejectsAdminEqualsDeployer() public {
        vm.expectRevert("admin==deployer");
        h.assertMainnetRoles(deployer, deployer, minterW);
    }

    // minter == deployer → revert（否则 minter 角色落在被销毁的钥上，cron 铸造全断）
    function testRejectsMinterEqualsDeployer() public {
        vm.expectRevert("minter==deployer");
        h.assertMainnetRoles(deployer, adminW, deployer);
    }

    // admin 零地址 → revert
    function testRejectsZeroAdmin() public {
        vm.expectRevert("admin=0");
        h.assertMainnetRoles(deployer, address(0), minterW);
    }

    // minter 零地址 → revert
    function testRejectsZeroMinter() public {
        vm.expectRevert("minter=0");
        h.assertMainnetRoles(deployer, adminW, address(0));
    }
}
