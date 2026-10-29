// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase, ITba} from "./PackTestBase.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";
import {PondSoulboundAsset} from "../../src/p22/PondSoulboundAsset.sol";
import {PondSoundNFT} from "../../src/p22/PondSoundNFT.sol";

contract SoulboundAssetTest is PackTestBase {
    address internal tba;

    function setUp() public override {
        super.setUp();
        tba = _open(_voucher(1, alice, _ids(3), 10 minutes));
    }

    function _exec(address from, address target, bytes memory data) internal returns (bool ok) {
        vm.prank(from);
        (ok,) = tba.call(abi.encodeCall(ITba.execute, (target, 0, data, 0)));
    }

    function test_ownerCannotTransferOutViaTba() public {
        bytes memory data = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)", tba, alice, uint256(1), uint256(1), ""
        );
        assertFalse(_exec(alice, address(sound), data));
        assertEq(sound.balanceOf(tba, 1), 1);
    }

    function test_batchTransferAndApprovalViaTbaRejected() public {
        uint256[] memory amounts = new uint256[](3);
        for (uint256 i = 0; i < 3; ++i) amounts[i] = 1;
        assertFalse(_exec(alice, address(sound), abi.encodeWithSignature(
            "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)", tba, alice, _ids(3), amounts, ""
        )));
        assertFalse(_exec(alice, address(sound), abi.encodeWithSignature("setApprovalForAll(address,bool)", bob, true)));
        assertFalse(_exec(alice, address(track), abi.encodeWithSignature("setApprovalForAll(address,bool)", bob, false)));
    }

    function test_thirdPartyAndDirectCallsRejected() public {
        vm.prank(bob);
        vm.expectRevert(); // 未授权：OZ 先于 Soulbound 钩子拦截
        sound.safeTransferFrom(tba, bob, 1, 1, "");
        vm.prank(alice);
        vm.expectRevert(PondSoulboundAsset.Soulbound.selector);
        sound.setApprovalForAll(bob, true);
        // 零数量转账与自转同样被拒
        vm.prank(tba);
        vm.expectRevert(PondSoulboundAsset.Soulbound.selector);
        sound.safeTransferFrom(tba, tba, 1, 0, "");
    }

    function test_noBurnPath() public {
        vm.prank(tba);
        vm.expectRevert(); // 转零地址被 OZ 拒；TBA 无法销毁素材
        sound.safeTransferFrom(tba, address(0), 1, 1, "");
        assertEq(sound.balanceOf(tba, 1), 1);
    }

    function test_afterScoreSaleNewHolderStillCannotTransferOut() public {
        vm.prank(alice);
        score.transferFrom(alice, bob, 1);
        assertEq(ITba(tba).owner(), bob);
        bytes memory data = abi.encodeWithSignature(
            "safeTransferFrom(address,address,uint256,uint256,bytes)", tba, bob, uint256(1), uint256(1), ""
        );
        assertFalse(_exec(bob, address(sound), data));
        assertFalse(_exec(alice, address(sound), data)); // 旧持有人本就无执行权
        assertEq(sound.balanceOf(tba, 1), 1);
    }

    function test_onlyOpenerMintsAndAdminCannotMint() public {
        vm.prank(admin);
        vm.expectRevert(PondSoulboundAsset.NotOpener.selector);
        sound.mint(admin, 1);
        vm.prank(admin);
        vm.expectRevert(PondSoulboundAsset.NotOpener.selector);
        sound.mintBatch(admin, _ids(1));
        // 铸造权不是角色：admin 授予任何角色都不能让他人铸造
        bytes32 pauserRole = sound.PAUSER_ROLE();
        vm.prank(admin);
        sound.grantRole(pauserRole, admin);
        vm.prank(admin);
        vm.expectRevert(PondSoulboundAsset.NotOpener.selector);
        sound.mint(admin, 1);
    }

    function test_defineIsAppendOnly() public {
        string[] memory u = new string[](1);
        u[0] = AR;
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PondSoulboundAsset.AlreadyDefined.selector, 1));
        sound.defineTokens(_ids(1), u);
        vm.prank(alice);
        vm.expectRevert();
        sound.defineTokens(_one(500), u);
        vm.prank(admin);
        vm.expectRevert(PondSoulboundAsset.InvalidPermanentURI.selector);
        sound.defineTokens(_one(500), _badUri());
    }

    function _badUri() internal pure returns (string[] memory a) {
        a = new string[](1);
        a[0] = "https://example.com/x";
    }

    function test_tbaReceivesErc1155AndScoreIntoTbaDoesNotCorrupt() public {
        assertTrue(ITba(tba).owner() == alice);
        (bool ok, bytes memory ret) = tba.staticcall(abi.encodeWithSignature("supportsInterface(bytes4)", bytes4(0x4e2312e0)));
        assertTrue(ok && abi.decode(ret, (bool)));
        // 外部钱包把 Score 转进自己的 TBA：合约状态不变，再开包仍拒绝
        vm.prank(alice);
        score.transferFrom(alice, tba, 1);
        ScorePackOpener.PackVoucher memory v = _voucher(1, tba, _ids(1), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.AlreadyOpened.selector, 1));
        opener.open(v, signer, sig);
        assertEq(sound.balanceOf(tba, 1), 1);
    }

    function test_uriAndMetadata() public view {
        assertEq(sound.uri(1), AR);
        assertTrue(sound.isSoulbound());
        assertEq(sound.contractURI(), AR);
        assertEq(sound.opener(), address(opener));
    }

    function test_assetConstructorRoleChecks() public {
        vm.expectRevert(PondSoulboundAsset.InvalidRoles.selector);
        new PondSoundNFT(AR, address(opener), admin, admin, 1 days);
        vm.expectRevert(PondSoulboundAsset.InvalidPermanentURI.selector);
        new PondSoundNFT("ar://short", address(opener), admin, pauser, 1 days);
    }
}
