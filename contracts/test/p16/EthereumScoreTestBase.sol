// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {EthereumScoreNFT} from "../../src/EthereumScoreNFT.sol";

contract RejectingScoreReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert("reject mint");
    }
}

contract MockScoreAuthorizer is IERC1271 {
    bytes32 public expectedDigest;
    bytes32 public expectedSignatureHash;

    function approve(bytes32 digest, bytes calldata signature) external {
        expectedDigest = digest;
        expectedSignatureHash = keccak256(signature);
    }

    function isValidSignature(bytes32 digest, bytes memory signature) external view returns (bytes4) {
        if (digest == expectedDigest && keccak256(signature) == expectedSignatureHash) {
            return IERC1271.isValidSignature.selector;
        }
        return bytes4(0xffffffff);
    }
}

abstract contract EthereumScoreTestBase is Test {
    EthereumScoreNFT internal nft;

    uint256 internal constant AUTHORIZER_KEY = 0xA11CE;
    uint48 internal constant ADMIN_DELAY = 2 days;
    address internal constant ADMIN = address(0xAD11);
    address internal constant PAUSER = address(0xFA05E);
    address internal constant RECIPIENT = address(0xCAFE);
    address internal constant OUTSIDER = address(0xBAD);

    string internal constant TOKEN_URI = "ar://TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT";
    string internal constant SECOND_URI = "ar://SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS";
    string internal constant COLLECTION_URI = "ar://CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

    address internal authorizer;

    function setUp() public virtual {
        authorizer = vm.addr(AUTHORIZER_KEY);
        nft = new EthereumScoreNFT(COLLECTION_URI, ADMIN_DELAY, ADMIN, authorizer, PAUSER);
    }

    function makeAuthorization(bytes32 orderId, uint256 tokenId, address recipient, string memory uri)
        internal
        view
        returns (EthereumScoreNFT.MintAuthorization memory)
    {
        return EthereumScoreNFT.MintAuthorization({
            orderId: orderId,
            tokenId: tokenId,
            recipient: recipient,
            tokenURIHash: keccak256(bytes(uri)),
            deadline: block.timestamp + 1 hours
        });
    }

    function signAuthorization(EthereumScoreNFT.MintAuthorization memory authorization, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, nft.authorizationDigest(authorization));
        return abi.encodePacked(r, s, v);
    }

    function redeem(EthereumScoreNFT.MintAuthorization memory authorization, string memory uri) internal {
        bytes memory signature = signAuthorization(authorization, AUTHORIZER_KEY);
        vm.prank(authorization.recipient);
        nft.redeem(authorization, uri, authorizer, signature);
    }
}
