// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {PondSoundNFT} from "../../src/p22/PondSoundNFT.sol";
import {PondTrackNFT} from "../../src/p22/PondTrackNFT.sol";
import {ScorePackOpener, IERC6551Registry} from "../../src/p22/ScorePackOpener.sol";

contract MockScore is ERC721 {
    constructor() ERC721("Score", "S") {}

    function mint(address to, uint256 id) external {
        _mint(to, id);
    }
}

interface ITba {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory);
    function owner() external view returns (address);
}

/// 用主网字节码 fixture 还原规范 Registry 与 TBA 实现（OP / ETH 主网 runtime hash 一致）。
abstract contract PackTestBase is Test {
    address internal constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address internal constant ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    string internal constant AR = "ar://AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    uint256 internal signerKey = 0xA11CE;
    address internal signer = vm.addr(0xA11CE);
    address internal admin = address(0xAD01);
    address internal pauser = address(0xBA05);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);

    MockScore internal score;
    PondSoundNFT internal sound;
    PondTrackNFT internal track;
    ScorePackOpener internal opener;

    function setUp() public virtual {
        vm.etch(REGISTRY, vm.parseBytes(vm.readFile("test/p22/fixtures/registry.hex")));
        vm.etch(ACCOUNT_IMPL, vm.parseBytes(vm.readFile("test/p22/fixtures/account.hex")));
        vm.warp(1_800_000_000);

        score = new MockScore();
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 2);
        sound = new PondSoundNFT(AR, predicted, admin, pauser, 1 days);
        track = new PondTrackNFT(AR, predicted, admin, pauser, 1 days);
        opener = new ScorePackOpener(
            address(score), address(sound), address(track), REGISTRY, ACCOUNT_IMPL, admin, signer, pauser, 1 days
        );
        assertEq(address(opener), predicted);

        uint256[] memory ids = new uint256[](70);
        string[] memory uris = new string[](70);
        for (uint256 i = 0; i < 70; ++i) {
            ids[i] = i + 1;
            uris[i] = AR;
        }
        vm.startPrank(admin);
        sound.defineTokens(ids, uris);
        track.defineTokens(_one(1), _oneUri());
        vm.stopPrank();
        score.mint(alice, 1);
    }

    function _one(uint256 id) internal pure returns (uint256[] memory a) {
        a = new uint256[](1);
        a[0] = id;
    }

    function _oneUri() internal pure returns (string[] memory a) {
        a = new string[](1);
        a[0] = AR;
    }

    function _ids(uint256 n) internal pure returns (uint256[] memory a) {
        a = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) a[i] = i + 1;
    }

    function _voucher(uint256 tokenId, address holder, uint256[] memory soundIds, uint256 ttl)
        internal
        view
        returns (ScorePackOpener.PackVoucher memory)
    {
        return ScorePackOpener.PackVoucher(tokenId, holder, 1, soundIds, block.timestamp + ttl);
    }

    function _sign(ScorePackOpener.PackVoucher memory v, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = opener.voucherDigest(v);
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, vv);
    }

    function _open(ScorePackOpener.PackVoucher memory v) internal returns (address) {
        return opener.open(v, signer, _sign(v, signerKey));
    }

    function _tba(uint256 tokenId) internal view returns (address) {
        return IERC6551Registry(REGISTRY).account(ACCOUNT_IMPL, bytes32(0), block.chainid, address(score), tokenId);
    }
}
