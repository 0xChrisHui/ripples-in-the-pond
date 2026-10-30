// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase, ITba} from "./PackTestBase.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";
import {PondSoulboundAsset} from "../../src/p22/PondSoulboundAsset.sol";

interface ITbaAdmin {
    function setPermissions(address[] calldata callers, bool[] calldata perms) external;
    function setOverrides(bytes4[] calldata selectors, address[] calldata impls) external;
    function upgradeTo(address impl) external;
}

/// 在账户里（经 sandbox delegatecall）执行：转去调用 Reenterer，尝试重入开包合约。
contract ReentryOverride {
    address internal immutable reenterer;
    bool internal immutable swallow;

    constructor(address reenterer_, bool swallow_) {
        reenterer = reenterer_;
        swallow = swallow_;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        returns (bytes4)
    {
        (bool ok, bytes memory ret) = reenterer.call(abi.encodeWithSignature("attack()"));
        if (!ok && !swallow) {
            assembly { revert(add(ret, 32), mload(ret)) }
        }
        return this.onERC1155BatchReceived.selector;
    }
}

contract Reenterer {
    ScorePackOpener internal immutable opener;
    ScorePackOpener.PackVoucher internal v;
    address internal signer;
    bytes internal sig;

    constructor(ScorePackOpener opener_) {
        opener = opener_;
    }

    function arm(ScorePackOpener.PackVoucher calldata v_, address signer_, bytes calldata sig_) external {
        v = v_;
        signer = signer_;
        sig = sig_;
    }

    function attack() external {
        opener.open(v, signer, sig);
    }
}

contract RejectOverride {
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return 0xdeadbeef;
    }
}

/// 对照测试：证明真实 TBA 字节码的 execute 本身可用，"素材转不出"不是因为 execute 坏了。
contract AccountIntegrationTest is PackTestBase {
    address internal carol = address(0xCA201);
    address internal tba;

    function setUp() public override {
        super.setUp();
        tba = _open(_voucher(1, alice, _ids(3), 10 minutes));
    }

    function test_positiveControl_ownerCanExecuteBenignCall() public {
        vm.deal(tba, 1 ether);
        vm.prank(alice);
        ITba(tba).execute(bob, 0.25 ether, "", 0);
        assertEq(bob.balance, 0.25 ether);

        vm.prank(bob); // 非持有人
        vm.expectRevert();
        ITba(tba).execute(bob, 0.25 ether, "", 0);
    }

    function test_tbaDirectTransferHitsSoulboundHook() public {
        vm.prank(tba);
        vm.expectRevert(PondSoulboundAsset.Soulbound.selector);
        sound.safeTransferFrom(tba, bob, 1, 1, "");
        vm.prank(alice);
        vm.expectRevert(PondSoulboundAsset.Soulbound.selector);
        ITba(tba).execute(
            address(sound), 0,
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256,uint256,bytes)", tba, alice, 1, 1, ""), 0
        );
    }

    /// 直接绑定逻辑合约：克隆账户的 ERC-1967 槽为空，UUPS onlyProxy 必然拒绝升级。
    function test_tbaIsNotUpgradeableInDirectBinding() public {
        vm.prank(alice);
        (bool ok,) = tba.call(abi.encodeCall(ITbaAdmin.upgradeTo, (ACCOUNT_IMPL)));
        assertFalse(ok);
        bytes32 slot = vm.load(tba, 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc);
        assertEq(slot, bytes32(0));
    }

    function test_oldOwnerPermissionsDoNotCarryOver() public {
        address[] memory callers = new address[](1);
        callers[0] = carol;
        bool[] memory perms = new bool[](1);
        perms[0] = true;
        vm.prank(alice);
        ITbaAdmin(tba).setPermissions(callers, perms);
        vm.deal(tba, 1 ether);
        vm.prank(carol);
        ITba(tba).execute(carol, 0.1 ether, "", 0);

        vm.prank(alice);
        score.transferFrom(alice, bob, 1);
        vm.prank(carol);
        vm.expectRevert();
        ITba(tba).execute(carol, 0.1 ether, "", 0);
    }

    function _armedOverride(bool swallow) internal returns (Reenterer r) {
        score.mint(alice, 2);
        score.mint(alice, 3);
        r = new Reenterer(opener);
        ScorePackOpener.PackVoucher memory v3 = _voucher(3, alice, _ids(2), 10 minutes);
        r.arm(v3, signer, _sign(v3, signerKey));

        // 持有人预先部署 #2 的账户并设置恶意回调覆盖
        (bool ok,) = REGISTRY.call(abi.encodeWithSignature(
            "createAccount(address,bytes32,uint256,address,uint256)",
            ACCOUNT_IMPL, bytes32(0), block.chainid, address(score), uint256(2)
        ));
        assertTrue(ok);
        bytes4[] memory sels = new bytes4[](1);
        sels[0] = ReentryOverride.onERC1155BatchReceived.selector;
        address[] memory impls = new address[](1);
        impls[0] = address(new ReentryOverride(address(r), swallow));
        address tba2 = _tba(2); // 先算地址：_tba 是外部调用，会吃掉 vm.prank
        vm.prank(alice);
        ITbaAdmin(tba2).setOverrides(sels, impls);
    }

    function test_holderOverrideReentryReverts() public {
        _armedOverride(false);
        ScorePackOpener.PackVoucher memory v2 = _voucher(2, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v2, signerKey);
        vm.expectRevert();
        opener.open(v2, signer, sig);
        assertFalse(opener.opened(2));
        assertFalse(opener.opened(3));
    }

    function test_holderOverrideReentryCannotSucceedEvenIfSwallowed() public {
        _armedOverride(true);
        _open(_voucher(2, alice, _ids(2), 10 minutes));
        assertTrue(opener.opened(2));
        assertFalse(opener.opened(3)); // 重入被 nonReentrant 拦下
        assertEq(sound.balanceOf(_tba(3), 1), 0);
        _open(_voucher(3, alice, _ids(2), 10 minutes)); // 事后正常开包不受影响
        assertTrue(opener.opened(3));
    }

    function test_holderRejectingReceiptOnlyHurtsOwnPack() public {
        score.mint(alice, 2);
        (bool ok,) = REGISTRY.call(abi.encodeWithSignature(
            "createAccount(address,bytes32,uint256,address,uint256)",
            ACCOUNT_IMPL, bytes32(0), block.chainid, address(score), uint256(2)
        ));
        assertTrue(ok);
        bytes4[] memory sels = new bytes4[](1);
        sels[0] = RejectOverride.onERC1155BatchReceived.selector;
        address[] memory impls = new address[](1);
        impls[0] = address(new RejectOverride());
        address tba2 = _tba(2); // 先算地址：_tba 是外部调用，会吃掉 vm.prank
        vm.prank(alice);
        ITbaAdmin(tba2).setOverrides(sels, impls);

        ScorePackOpener.PackVoucher memory v2 = _voucher(2, alice, _ids(2), 10 minutes);
        bytes memory sig = _sign(v2, signerKey);
        vm.expectRevert();
        opener.open(v2, signer, sig);
        assertFalse(opener.opened(2));
        assertEq(track.balanceOf(_tba(2), 1), 0);

        // 换主人后旧覆盖失效，新持有人可以正常开包
        vm.prank(alice);
        score.transferFrom(alice, bob, 2);
        _open(_voucher(2, bob, _ids(2), 10 minutes));
        assertTrue(opener.opened(2));
    }
}
