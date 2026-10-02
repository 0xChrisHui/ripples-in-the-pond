// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Test} from "forge-std/Test.sol";
import {EthereumMaterialNFT} from "../../src/p17/EthereumMaterialNFT.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// 仅非生产测试夹具：每 token 最多3次，用于证明通用安全，不代表发行政策。
contract BoundedMaterialHarness is EthereumMaterialNFT {
    mapping(uint256 => uint256) private _testSupply;
    constructor(uint256[35] memory ids, string[35] memory uris, address admin_, address signer_, address pauser_)
        EthereumMaterialNFT(ids, uris, "ar://CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", admin_, signer_, pauser_) {
        require(block.chainid == 31337, "local only");
    }
    function _consumeIssuancePolicy(MaterialMintAuthorization calldata a) internal override {
        require(++_testSupply[a.tokenId] <= 3, "bounded local fixture");
    }
}
contract MaterialReceiver is IERC1155Receiver {
    bool public reject;
    bytes public reentry;
    bool public reentrySucceeded;
    function configure(bool value, bytes memory data) external { reject = value; reentry = data; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(IERC1155Receiver).interfaceId; }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        require(!reject, "reject");
        if (reentry.length != 0) (reentrySucceeded,) = msg.sender.call(reentry);
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4) { revert("batch unused"); }
}
abstract contract MaterialTestBase is Test {
    EthereumMaterialNFT internal nft;
    uint256 internal constant KEY = 0xA11CE;
    address internal constant ADMIN = address(0xAD11);
    address internal constant PAUSER = address(0xFA05E);
    address internal constant RECIPIENT = address(0xCAFE);
    string internal constant URI = "ar://TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT";
    address internal signer;
    function metadata() internal pure returns (uint256[35] memory ids, string[35] memory uris) {
        for (uint256 i; i < 35; ++i) { ids[i] = i + 1; uris[i] = URI; }
    }
    function setUp() public virtual {
        vm.chainId(31337);
        signer = vm.addr(KEY);
        (uint256[35] memory ids, string[35] memory uris) = metadata();
        nft = new EthereumMaterialNFT(ids, uris, "ar://CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", ADMIN, signer, PAUSER);
    }
    function authorization(bytes32 id) internal view returns (EthereumMaterialNFT.MaterialMintAuthorization memory) {
        return EthereumMaterialNFT.MaterialMintAuthorization(id, 1, 1, RECIPIENT, keccak256(bytes(URI)), block.timestamp + 900);
    }
    function signature(EthereumMaterialNFT.MaterialMintAuthorization memory a) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(KEY, nft.authorizationDigest(a));
        return abi.encodePacked(r, s, v);
    }
    function redeem(EthereumMaterialNFT.MaterialMintAuthorization memory a) internal {
        bytes memory sig = signature(a); vm.prank(a.recipient); nft.redeem(a, signer, sig);
    }
}
