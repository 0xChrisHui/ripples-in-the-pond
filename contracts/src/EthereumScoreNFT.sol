// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {PermanentArUri} from "./PermanentArUri.sol";

/// Ethereum 自付 Gas 的 ScoreNFT；voucher 只授权接收人自己发起一次铸造。
contract EthereumScoreNFT is ERC721URIStorage, EIP712, AccessControlDefaultAdminRules, Pausable {
    string public constant COLLECTION_NAME = "Ripples in the Pond";
    string public constant COLLECTION_SYMBOL = "RPIP";
    string public constant SIGNING_VERSION = "1";

    bytes32 public constant AUTHORIZER_ROLE = keccak256("AUTHORIZER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINT_AUTHORIZATION_TYPEHASH = keccak256(
        "MintAuthorization(bytes32 orderId,uint256 tokenId,address recipient,bytes32 tokenURIHash,uint256 deadline)"
    );

    bytes4 private constant _INTERFACE_ID_ERC7572 = 0xe8a3d485;
    string private _collectionUri;

    mapping(bytes32 => uint256) public tokenIdByOrderId;

    struct MintAuthorization {
        bytes32 orderId;
        uint256 tokenId;
        address recipient;
        bytes32 tokenURIHash;
        uint256 deadline;
    }

    event ScoreRedeemed(
        bytes32 indexed orderId, address indexed recipient, uint256 indexed tokenId, bytes32 tokenURIHash
    );

    error InvalidPermanentURI();
    error ZeroRoleAddress();
    error RolesMustDiffer();
    error InvalidTokenId();
    error EmptyOrderId();
    error CallerNotRecipient(address caller, address recipient);
    error AuthorizationExpired(uint256 deadline);
    error OrderAlreadyRedeemed(bytes32 orderId, uint256 tokenId);
    error TokenAlreadyMinted(uint256 tokenId);
    error TokenURIHashMismatch();
    error UnauthorizedAuthorizer(address authorizer);
    error InvalidSignature();

    constructor(
        string memory collectionUri_,
        uint48 defaultAdminDelay_,
        address admin_,
        address authorizer_,
        address pauser_
    )
        ERC721(COLLECTION_NAME, COLLECTION_SYMBOL)
        EIP712(COLLECTION_NAME, SIGNING_VERSION)
        AccessControlDefaultAdminRules(defaultAdminDelay_, admin_)
    {
        if (!PermanentArUri.isValid(collectionUri_)) {
            revert InvalidPermanentURI();
        }
        if (authorizer_ == address(0) || pauser_ == address(0)) revert ZeroRoleAddress();
        if (admin_ == authorizer_ || admin_ == pauser_ || authorizer_ == pauser_) revert RolesMustDiffer();

        _collectionUri = collectionUri_;
        _grantRole(AUTHORIZER_ROLE, authorizer_);
        _grantRole(PAUSER_ROLE, pauser_);
    }

    function redeem(
        MintAuthorization calldata authorization,
        string calldata tokenUri,
        address authorizer,
        bytes calldata signature
    ) external whenNotPaused {
        if (authorization.tokenId == 0) revert InvalidTokenId();
        if (authorization.orderId == bytes32(0)) revert EmptyOrderId();
        if (msg.sender != authorization.recipient) {
            revert CallerNotRecipient(msg.sender, authorization.recipient);
        }
        if (block.timestamp > authorization.deadline) revert AuthorizationExpired(authorization.deadline);

        uint256 existingTokenId = tokenIdByOrderId[authorization.orderId];
        if (existingTokenId != 0) revert OrderAlreadyRedeemed(authorization.orderId, existingTokenId);
        if (_exists(authorization.tokenId)) revert TokenAlreadyMinted(authorization.tokenId);
        if (!PermanentArUri.isValid(tokenUri)) revert InvalidPermanentURI();
        if (keccak256(bytes(tokenUri)) != authorization.tokenURIHash) revert TokenURIHashMismatch();
        if (!hasRole(AUTHORIZER_ROLE, authorizer)) revert UnauthorizedAuthorizer(authorizer);
        if (!SignatureChecker.isValidSignatureNow(authorizer, authorizationDigest(authorization), signature)) {
            revert InvalidSignature();
        }

        tokenIdByOrderId[authorization.orderId] = authorization.tokenId;
        _safeMint(authorization.recipient, authorization.tokenId);
        _setTokenURI(authorization.tokenId, tokenUri);
        emit ScoreRedeemed(
            authorization.orderId, authorization.recipient, authorization.tokenId, authorization.tokenURIHash
        );
    }

    function authorizationStructHash(MintAuthorization calldata authorization) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                MINT_AUTHORIZATION_TYPEHASH,
                authorization.orderId,
                authorization.tokenId,
                authorization.recipient,
                authorization.tokenURIHash,
                authorization.deadline
            )
        );
    }

    function authorizationDigest(MintAuthorization calldata authorization) public view returns (bytes32) {
        return _hashTypedDataV4(authorizationStructHash(authorization));
    }

    function contractURI() external view returns (string memory) {
        return _collectionUri;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControlDefaultAdminRules)
        returns (bool)
    {
        return interfaceId == _INTERFACE_ID_ERC7572 || super.supportsInterface(interfaceId);
    }
}
