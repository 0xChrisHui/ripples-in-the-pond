// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OriginalMetadata} from "./OriginalMetadata.sol";

/// 2026-10-03用户批准：每钱包每原曲终身领取一次，可转让，不设每曲总量上限。
contract EthereumMaterialNFT is ERC1155, EIP712, AccessControlDefaultAdminRules, Pausable,
    ReentrancyGuard, OriginalMetadata {
    bytes32 public constant AUTHORIZER_ROLE = keccak256("AUTHORIZER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MATERIAL_TYPEHASH = keccak256(
        "MaterialMintAuthorization(bytes32 orderId,uint256 tokenId,uint256 amount,address recipient,bytes32 tokenURIHash,uint256 deadline)"
    );
    mapping(bytes32 => bool) public redeemedOrders;
    // 历史领取资格与持有余额分开；转出/转入均不能重置已使用的资格。
    mapping(address => mapping(uint256 => bool)) public hasClaimed;
    struct MaterialMintAuthorization {
        bytes32 orderId;
        uint256 tokenId;
        uint256 amount;
        address recipient;
        bytes32 tokenURIHash;
        uint256 deadline;
    }
    event MaterialRedeemed(bytes32 indexed orderId, address indexed recipient, uint256 indexed tokenId,
        uint256 amount, bytes32 tokenURIHash);
    error InvalidRoles();
    error InvalidAuthorization();
    error OrderAlreadyRedeemed();
    error UnauthorizedAuthorizer();
    error InvalidSignature();
    error MaterialAlreadyClaimed();

    constructor(uint256[35] memory ids, string[35] memory uris, string memory collectionUri_,
        address admin_, address authorizer_, address pauser_)
        ERC1155("") EIP712("Ripples in the Pond Originals", "1")
        AccessControlDefaultAdminRules(2 days, admin_) OriginalMetadata(ids, uris, collectionUri_) {
        if (admin_ == address(0) || authorizer_ == address(0) || pauser_ == address(0)
            || admin_ == authorizer_ || admin_ == pauser_ || authorizer_ == pauser_) revert InvalidRoles();
        _grantRole(AUTHORIZER_ROLE, authorizer_);
        _grantRole(PAUSER_ROLE, pauser_);
    }
    function uri(uint256 id) public view override returns (string memory) { return originalUri(id); }
    function redeem(MaterialMintAuthorization calldata a, address authorizer, bytes calldata signature)
        external whenNotPaused nonReentrant {
        if (a.orderId == bytes32(0) || a.recipient == address(0) || msg.sender != a.recipient
            || a.amount != 1 || block.timestamp > a.deadline || keccak256(bytes(uri(a.tokenId))) != a.tokenURIHash) {
            revert InvalidAuthorization();
        }
        if (redeemedOrders[a.orderId]) revert OrderAlreadyRedeemed();
        if (!hasRole(AUTHORIZER_ROLE, authorizer)) revert UnauthorizedAuthorizer();
        if (!SignatureChecker.isValidSignatureNow(authorizer, authorizationDigest(a), signature)) revert InvalidSignature();
        _consumeIssuancePolicy(a);
        redeemedOrders[a.orderId] = true;
        _mint(a.recipient, a.tokenId, 1, "");
        emit MaterialRedeemed(a.orderId, a.recipient, a.tokenId, 1, a.tokenURIHash);
    }
    // 在接收回调前消费，mint或回调失败时由整笔交易原子回滚。
    function _consumeIssuancePolicy(MaterialMintAuthorization calldata a) internal virtual {
        if (hasClaimed[a.recipient][a.tokenId]) revert MaterialAlreadyClaimed();
        hasClaimed[a.recipient][a.tokenId] = true;
    }
    function authorizationStructHash(MaterialMintAuthorization calldata a) public pure returns (bytes32) {
        return keccak256(abi.encode(MATERIAL_TYPEHASH, a.orderId, a.tokenId, a.amount, a.recipient, a.tokenURIHash, a.deadline));
    }
    function authorizationDigest(MaterialMintAuthorization calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(authorizationStructHash(a));
    }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControlDefaultAdminRules)
        returns (bool) { return interfaceId == 0xe8a3d485 || super.supportsInterface(interfaceId); }
}
