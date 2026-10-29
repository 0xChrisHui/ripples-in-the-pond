// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase, ITba} from "./PackTestBase.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";
import {PondSoulboundAsset} from "../../src/p22/PondSoulboundAsset.sol";

contract ScorePackOpenerTest is PackTestBase {
    function test_fixturesMatchMainnetHashes() public view {
        assertEq(REGISTRY.codehash, 0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735);
        assertEq(ACCOUNT_IMPL.codehash, 0xdf5eeb80b53e48dfd667fff5264976de4004fdd27eef4f6b954d182109f0f85b);
    }

    function test_openMintsPackIntoTba() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(5), 10 minutes);
        address tba = _open(v);
        assertEq(tba, _tba(1));
        assertEq(tba, opener.accountOf(1));
        assertTrue(opener.opened(1));
        assertEq(track.balanceOf(tba, 1), 1);
        for (uint256 i = 1; i <= 5; ++i) assertEq(sound.balanceOf(tba, i), 1);
        assertEq(sound.balanceOf(tba, 6), 0);
        assertEq(ITba(tba).owner(), alice);
    }

    function test_secondOpenRejected() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        _open(v);
        ScorePackOpener.PackVoucher memory v2 = _voucher(1, alice, _ids(3), 10 minutes);
        bytes memory sig = _sign(v2, signerKey);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.AlreadyOpened.selector, 1));
        opener.open(v2, signer, sig);
    }

    function test_anyoneCanSubmitButAssetsGoToScoreAccount() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(bob);
        address tba = opener.open(v, signer, sig);
        assertEq(track.balanceOf(tba, 1), 1);
        assertEq(track.balanceOf(bob, 1), 0);
    }

    function test_rejectsAfterScoreTransferredAway() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        score.transferFrom(alice, bob, 1);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.NotHolder.selector, alice, bob));
        opener.open(v, signer, sig);
    }

    /// 冻结策略：不加撤销 epoch。A→B→A 后旧凭证重新有效，靠 MAX_VALIDITY 与 signer 轮换兜底。
    function test_oldVoucherRevivesAfterRoundTrip() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        score.transferFrom(alice, bob, 1);
        vm.prank(bob);
        score.transferFrom(bob, alice, 1);
        opener.open(v, signer, sig);
        assertTrue(opener.opened(1));
    }

    function test_expiredAndTooFarRejected() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.warp(block.timestamp + 11 minutes);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.Expired.selector, v.deadline));
        opener.open(v, signer, sig);

        ScorePackOpener.PackVoucher memory far = _voucher(1, alice, _ids(2), 2 hours);
        bytes memory farSig = _sign(far, signerKey);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.DeadlineTooFar.selector, far.deadline));
        opener.open(far, signer, farSig);
    }

    function test_badSignerOrSignatureRejected() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        address rogue = vm.addr(0xBAD);
        bytes memory rogueSig = _sign(v, 0xBAD);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.UnauthorizedSigner.selector, rogue));
        opener.open(v, rogue, rogueSig);
        vm.expectRevert(ScorePackOpener.InvalidSignature.selector);
        opener.open(v, signer, rogueSig); // 冒用合法 signer 地址
    }

    function test_tamperedSoundListRejected() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        v.soundIds = _ids(3);
        vm.expectRevert(ScorePackOpener.InvalidSignature.selector);
        opener.open(v, signer, sig);
    }

    function test_crossChainVoucherRejected() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.chainId(10);
        vm.expectRevert(ScorePackOpener.InvalidSignature.selector);
        opener.open(v, signer, sig);
    }

    function test_badSoundListsRejected() public {
        uint256[] memory dup = new uint256[](2);
        dup[0] = 2;
        dup[1] = 2;
        uint256[] memory desc = new uint256[](2);
        desc[0] = 3;
        desc[1] = 2;
        uint256[][3] memory bad = [new uint256[](0), dup, desc];
        for (uint256 i = 0; i < 3; ++i) {
            ScorePackOpener.PackVoucher memory v = _voucher(1, alice, bad[i], 10 minutes);
            bytes memory sig = _sign(v, signerKey);
            vm.expectRevert(ScorePackOpener.BadSoundList.selector);
            opener.open(v, signer, sig);
        }
        ScorePackOpener.PackVoucher memory over = _voucher(1, alice, _ids(65), 10 minutes);
        bytes memory overSig = _sign(over, signerKey);
        vm.expectRevert(ScorePackOpener.BadSoundList.selector);
        opener.open(over, signer, overSig);
    }

    function test_unknownSoundRollsBackEverything() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 999; // 未登记
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, ids, 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.expectRevert(abi.encodeWithSelector(PondSoulboundAsset.UnknownToken.selector, 999));
        opener.open(v, signer, sig);
        assertFalse(opener.opened(1));
        assertEq(track.balanceOf(_tba(1), 1), 0);
        assertEq(_tba(1).code.length, 0); // Registry 创建账户也一并回滚
    }

    function test_preDeployedAccountDoesNotBlockOpen() public {
        (bool ok,) = REGISTRY.call(
            abi.encodeWithSignature(
                "createAccount(address,bytes32,uint256,address,uint256)",
                ACCOUNT_IMPL, bytes32(0), block.chainid, address(score), uint256(1)
            )
        );
        assertTrue(ok);
        assertGt(_tba(1).code.length, 0);
        _open(_voucher(1, alice, _ids(2), 10 minutes));
        assertEq(track.balanceOf(_tba(1), 1), 1);
    }

    function test_pausedOpenerOrAssetBlocksOpen() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(pauser);
        sound.pause();
        vm.expectRevert("Pausable: paused");
        opener.open(v, signer, sig);
        assertFalse(opener.opened(1));
        vm.prank(admin);
        sound.unpause();

        vm.prank(pauser);
        opener.pause();
        vm.expectRevert("Pausable: paused");
        opener.open(v, signer, sig);
        vm.prank(admin);
        opener.unpause();
        opener.open(v, signer, sig);
    }

    function test_signerRevokeAndRotate() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        bytes32 role = opener.SIGNER_ROLE();
        vm.prank(admin);
        opener.revokeRole(role, signer);
        vm.expectRevert(abi.encodeWithSelector(ScorePackOpener.UnauthorizedSigner.selector, signer));
        opener.open(v, signer, sig);

        address next = vm.addr(0xC0DE);
        vm.prank(admin);
        opener.grantRole(role, next);
        opener.open(v, next, _sign(v, 0xC0DE));
    }

    function test_maxListGas() public {
        ScorePackOpener.PackVoucher memory v = _voucher(1, alice, _ids(64), 10 minutes);
        bytes memory sig = _sign(v, signerKey);
        uint256 g = gasleft();
        opener.open(v, signer, sig);
        emit log_named_uint("gas open(64 sounds + track, new TBA)", g - gasleft());
    }

    function test_constructorRoleChecks() public {
        vm.expectRevert(ScorePackOpener.InvalidConfig.selector);
        new ScorePackOpener(
            address(score), address(sound), address(track), REGISTRY, ACCOUNT_IMPL, admin, admin, pauser, 1 days
        );
        vm.expectRevert(ScorePackOpener.InvalidConfig.selector);
        new ScorePackOpener(
            address(score), address(sound), address(track), REGISTRY, address(0x1234), admin, signer, pauser, 1 days
        );
    }
}
