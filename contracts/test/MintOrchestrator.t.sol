// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ScoreNFT.sol";
import "../src/MintOrchestrator.sol";

/**
 * MintOrchestrator 单元测试 — Phase 3 Step S3
 *
 * 关键测试链路：
 * 1. 部署 ScoreNFT（minter = deployer 自身）
 * 2. 部署 Orchestrator（绑定 ScoreNFT 地址）
 * 3. ScoreNFT.grantRole(MINTER_ROLE, orchestrator) — 关键授权步骤
 * 4. operator 调 orchestrator.mintScore(user) → 拿到 tokenId
 * 5. 验证 ScoreNFT.ownerOf(tokenId) == user
 *
 * 也覆盖：权限正反 + tbaEnabled toggle + 钩子空时两种状态都能 mint
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
        uint256 tokenId = orchestrator.mintScore(user);

        assertEq(tokenId, 1, "first tokenId should be 1");
        assertEq(nft.ownerOf(tokenId), user, "user owns minted token");
    }

    function testMintScoreIncrementing() public {
        vm.startPrank(deployer);
        uint256 id1 = orchestrator.mintScore(user);
        uint256 id2 = orchestrator.mintScore(user);
        uint256 id3 = orchestrator.mintScore(outsider);
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
        orchestrator.mintScore(user);
    }

    // ───────── 权限 ─────────

    function testMintScoreRevertsForNonMinter() public {
        vm.prank(outsider);
        vm.expectRevert();
        orchestrator.mintScore(user);
    }

    function testMintScoreRevertsIfOrchestratorNotAuthorizedOnNFT() public {
        // 边界情况：如果忘了 grantRole，调用应该 revert（因为 ScoreNFT 拒绝 mint）
        vm.startPrank(deployer);
        ScoreNFT freshNft = new ScoreNFT("X", "X", deployer);
        MintOrchestrator freshOrch = new MintOrchestrator(address(freshNft));
        // 注意：故意 *不* 调 grantRole

        vm.expectRevert();
        freshOrch.mintScore(user);
        vm.stopPrank();
    }

    // ───────── TBA 开关 ─────────

    function testTbaEnabledDefaultsFalse() public view {
        assertFalse(orchestrator.tbaEnabled(), "TBA must default to false");
    }

    function testSetTbaEnabledByAdmin() public {
        vm.prank(deployer);
        orchestrator.setTbaEnabled(true);
        assertTrue(orchestrator.tbaEnabled());

        vm.prank(deployer);
        orchestrator.setTbaEnabled(false);
        assertFalse(orchestrator.tbaEnabled());
    }

    function testSetTbaEnabledRevertsForNonAdmin() public {
        vm.prank(outsider);
        vm.expectRevert();
        orchestrator.setTbaEnabled(true);
    }

    function testMintScoreWorksWhenTbaEnabled() public {
        // 钩子目前是空的，开 / 关都应该能 mint 成功
        vm.prank(deployer);
        orchestrator.setTbaEnabled(true);

        vm.prank(deployer);
        uint256 id = orchestrator.mintScore(user);
        assertEq(id, 1);
        assertEq(nft.ownerOf(id), user);
    }

    function testMintScoreWorksWhenTbaDisabled() public {
        // 默认 false 状态
        vm.prank(deployer);
        uint256 id = orchestrator.mintScore(user);
        assertEq(id, 1);
        assertEq(nft.ownerOf(id), user);
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
