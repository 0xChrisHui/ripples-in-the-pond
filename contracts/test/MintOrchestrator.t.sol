// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ScoreNFT.sol";
import "../src/MintOrchestrator.sol";

/**
 * MintOrchestrator 单元测试 — Phase 3 Step S3 + CT-4（orderId 幂等）
 *
 * 关键测试链路：
 * 1. 部署 ScoreNFT（minter = deployer 自身）
 * 2. 部署 Orchestrator（绑定 ScoreNFT 地址）
 * 3. ScoreNFT.grantRole(MINTER_ROLE, orchestrator) — 关键授权步骤
 * 4. operator 调 orchestrator.mintScore(user, orderId) → 拿到 tokenId
 * 5. 验证 ScoreNFT.ownerOf(tokenId) == user
 *
 * 也覆盖：权限正反 + 构造参数校验 + CT-4 同 orderId 二次铸造 revert
 *
 * Phase 6 D-C3：TBA 开关 + 钩子已删除（参见 MintOrchestrator.sol 注释）
 */
contract MintOrchestratorTest is Test {
    ScoreNFT nft;
    MintOrchestrator orchestrator;

    address deployer = address(0xA11CE);
    address user = address(0xC0FFEE);
    address outsider = address(0xDEADBEEF);

    function setUp() public {
        vm.startPrank(deployer);
        nft = new ScoreNFT(
            "Ripples in the Pond Score (Testnet)",
            "RIPS",
            deployer
        );
        orchestrator = new MintOrchestrator(address(nft));
        // 关键授权：让 Orchestrator 能调 ScoreNFT.mint
        nft.grantRole(nft.MINTER_ROLE(), address(orchestrator));
        vm.stopPrank();
    }

    // ───────── 核心通路 ─────────

    function testMintScoreEndToEnd() public {
        vm.prank(deployer);
        uint256 tokenId = orchestrator.mintScore(user, bytes32("o1"));

        assertEq(tokenId, 1, "first tokenId should be 1");
        assertEq(nft.ownerOf(tokenId), user, "user owns minted token");
        assertEq(orchestrator.tokenIdByOrderId(bytes32("o1")), 1, "orderId maps to tokenId");
    }

    function testMintScoreIncrementing() public {
        vm.startPrank(deployer);
        uint256 id1 = orchestrator.mintScore(user, bytes32("o1"));
        uint256 id2 = orchestrator.mintScore(user, bytes32("o2"));
        uint256 id3 = orchestrator.mintScore(outsider, bytes32("o3"));
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(nft.balanceOf(user), 2);
        assertEq(nft.balanceOf(outsider), 1);
    }

    function testMintScoreEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit MintOrchestrator.ScoreMinted(user, 1);

        vm.prank(deployer);
        orchestrator.mintScore(user, bytes32("o1"));
    }

    // ───────── CT-4 幂等 ─────────

    function testMintScoreRejectsDuplicateOrderId() public {
        // 同 orderId 二次铸造必须 revert —— 后端重试 / lease 竞态的双铸防线
        vm.startPrank(deployer);
        uint256 id1 = orchestrator.mintScore(user, bytes32("dup"));
        assertEq(id1, 1);

        vm.expectRevert("orderId used");
        orchestrator.mintScore(user, bytes32("dup"));
        vm.stopPrank();

        // 只铸出一枚，orderId 映射稳定
        assertEq(nft.balanceOf(user), 1, "duplicate must not mint a second token");
        assertEq(orchestrator.tokenIdByOrderId(bytes32("dup")), 1);
    }

    // ───────── 权限 ─────────

    function testMintScoreRevertsForNonMinter() public {
        vm.prank(outsider);
        vm.expectRevert();
        orchestrator.mintScore(user, bytes32("o1"));
    }

    function testMintScoreRevertsIfOrchestratorNotAuthorizedOnNFT() public {
        // 边界情况：如果忘了 grantRole，调用应该 revert（因为 ScoreNFT 拒绝 mint）
        vm.startPrank(deployer);
        ScoreNFT freshNft = new ScoreNFT("X", "X", deployer);
        MintOrchestrator freshOrch = new MintOrchestrator(address(freshNft));
        // 注意：故意 *不* 调 grantRole

        vm.expectRevert();
        freshOrch.mintScore(user, bytes32("o1"));
        vm.stopPrank();
    }

    // ───────── 构造检查 ─────────

    function testConstructorRejectsZeroAddress() public {
        vm.expectRevert();
        new MintOrchestrator(address(0));
    }

    function testScoreNftAddressBoundOnConstruction() public view {
        assertEq(address(orchestrator.scoreNft()), address(nft));
    }
}
