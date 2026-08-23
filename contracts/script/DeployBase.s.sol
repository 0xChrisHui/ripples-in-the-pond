// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * DeployBase — 部署脚本共享基座：集中主网角色安全护栏（CT-2 硬失败 + CT-3 移交安全）
 *
 * 红线（用户 2026-07-19 拍板）：admin = 独立普通钱包，**绝不等于铸造热钱包(minter)**。
 * - 主网（chainid 10）：ADMIN_ADDRESS / MINTER_ADDRESS 必须显式提供（缺失即 revert），
 *   且都非零、互不相同、都 ≠ deployer（deployer 私钥部署后即销毁，不能持有任何长期角色）。
 * - 测试网：env 缺省回退 deployer = admin = minter（简化模式，零配置照旧）。
 *
 * 为什么集中在这里：部署脚本是部署日逐行审计的最高危代码，把红线护栏放一处，
 * 避免 3 个脚本各抄一份导致漂移。
 */
abstract contract DeployBase is Script {
    // OZ AccessControl 的 DEFAULT_ADMIN_ROLE 常量 = bytes32(0)
    bytes32 internal constant ADMIN_ROLE = 0x00;

    /// 解析 admin / minter，主网强制安全护栏，缺失/踩红线即 revert（在 broadcast 前调，fail fast）
    function _resolveRoles(address deployer)
        internal
        view
        returns (address admin, address minter)
    {
        if (block.chainid == 10) {
            admin = vm.envAddress("ADMIN_ADDRESS");
            minter = vm.envAddress("MINTER_ADDRESS");
            _assertMainnetRoles(deployer, admin, minter);
        } else {
            admin = vm.envOr("ADMIN_ADDRESS", deployer);
            minter = vm.envOr("MINTER_ADDRESS", deployer);
        }
    }

    /// 主网角色红线护栏（纯逻辑，与 env I/O 分离以便确定性单测）。
    /// 踩任一条即 revert：非零 / 都 ≠ deployer / admin ≠ minter(热钱包红线)。
    function _assertMainnetRoles(address deployer, address admin, address minter) internal pure {
        require(admin != address(0), "admin=0");
        require(minter != address(0), "minter=0");
        require(admin != deployer, "admin==deployer");
        require(minter != deployer, "minter==deployer");
        require(admin != minter, "admin==minter: hot wallet redline");
    }

    /// 移交 target 的 DEFAULT_ADMIN_ROLE：deployer → admin。
    /// CT-3：先 grant、链上确认新 admin 已持有该角色，再 revoke deployer——
    /// 避免"grant 未生效却已弃权"导致合约永久失控。admin==deployer（测试网）则跳过。
    function _handoverAdmin(address target, address deployer, address admin) internal {
        if (admin == deployer) return;
        IAccessControl ac = IAccessControl(target);
        ac.grantRole(ADMIN_ROLE, admin);
        require(ac.hasRole(ADMIN_ROLE, admin), "grant admin failed");
        ac.revokeRole(ADMIN_ROLE, deployer);
    }
}
