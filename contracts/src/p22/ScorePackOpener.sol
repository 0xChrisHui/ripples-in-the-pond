// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

interface IERC6551Registry {
    function createAccount(address impl, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId)
        external
        returns (address);
    function account(address impl, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId)
        external
        view
        returns (address);
}

interface IPondAsset {
    function mint(address to, uint256 id) external;
    function mintBatch(address to, uint256[] calldata ids) external;
}

/// 验服务端凭证 → 创建 Score 的 ERC-6551 账户 → 把背景音乐与音效各铸 1 份进该账户。
/// 任何人都可提交：凭证固定了 Score 与素材，素材只进这枚 Score 自己的账户。
contract ScorePackOpener is EIP712, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant PACK_VOUCHER_TYPEHASH = keccak256(
        "PackVoucher(uint256 scoreTokenId,address holder,uint256 trackTokenId,bytes32 soundIdsHash,uint256 deadline)"
    );
    bytes32 public constant ACCOUNT_SALT = bytes32(0);
    uint256 public constant MAX_SOUNDS = 64;
    uint256 public constant MAX_VALIDITY = 1 hours;

    IERC721 public immutable score;
    IPondAsset public immutable sounds;
    IPondAsset public immutable tracks;
    IERC6551Registry public immutable registry;
    address public immutable accountImplementation;

    mapping(uint256 => bool) public opened;

    struct PackVoucher {
        uint256 scoreTokenId;
        address holder;
        uint256 trackTokenId;
        uint256[] soundIds;
        uint256 deadline;
    }

    event PackOpened(
        uint256 indexed scoreTokenId,
        address indexed account,
        address indexed holder,
        uint256 trackTokenId,
        uint256[] soundIds,
        address caller
    );

    error InvalidConfig();
    error Expired(uint256 deadline);
    error DeadlineTooFar(uint256 deadline);
    error NotHolder(address holder, address actual);
    error AlreadyOpened(uint256 scoreTokenId);
    error BadSoundList();
    error UnauthorizedSigner(address signer);
    error InvalidSignature();

    constructor(
        address score_,
        address sounds_,
        address tracks_,
        address registry_,
        address accountImpl_,
        address admin_,
        address signer_,
        address pauser_,
        uint48 adminDelay_
    ) EIP712("Ripples Pond Score Pack", "1") AccessControlDefaultAdminRules(adminDelay_, admin_) {
        if (
            score_.code.length == 0 || registry_.code.length == 0 || accountImpl_.code.length == 0
                || sounds_ == address(0) || tracks_ == address(0) || sounds_ == tracks_
        ) revert InvalidConfig();
        if (signer_ == address(0) || pauser_ == address(0)) revert InvalidConfig();
        if (admin_ == signer_ || admin_ == pauser_ || signer_ == pauser_) revert InvalidConfig();
        score = IERC721(score_);
        sounds = IPondAsset(sounds_);
        tracks = IPondAsset(tracks_);
        registry = IERC6551Registry(registry_);
        accountImplementation = accountImpl_;
        _grantRole(SIGNER_ROLE, signer_);
        _grantRole(PAUSER_ROLE, pauser_);
    }

    function open(PackVoucher calldata v, address signer, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
        returns (address account)
    {
        if (block.timestamp > v.deadline) revert Expired(v.deadline);
        if (v.deadline > block.timestamp + MAX_VALIDITY) revert DeadlineTooFar(v.deadline);
        if (!hasRole(SIGNER_ROLE, signer)) revert UnauthorizedSigner(signer);
        if (!SignatureChecker.isValidSignatureNow(signer, voucherDigest(v), signature)) revert InvalidSignature();

        address actual = score.ownerOf(v.scoreTokenId);
        if (actual != v.holder) revert NotHolder(v.holder, actual);
        if (opened[v.scoreTokenId]) revert AlreadyOpened(v.scoreTokenId);
        _checkSounds(v.soundIds);

        opened[v.scoreTokenId] = true; // 先置位；以下任一步失败整体回滚
        account = registry.createAccount(
            accountImplementation, ACCOUNT_SALT, block.chainid, address(score), v.scoreTokenId
        );
        tracks.mint(account, v.trackTokenId);
        sounds.mintBatch(account, v.soundIds);
        emit PackOpened(v.scoreTokenId, account, v.holder, v.trackTokenId, v.soundIds, msg.sender);
    }

    function accountOf(uint256 scoreTokenId) external view returns (address) {
        return registry.account(accountImplementation, ACCOUNT_SALT, block.chainid, address(score), scoreTokenId);
    }

    function voucherStructHash(PackVoucher calldata v) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                PACK_VOUCHER_TYPEHASH,
                v.scoreTokenId,
                v.holder,
                v.trackTokenId,
                keccak256(abi.encodePacked(v.soundIds)),
                v.deadline
            )
        );
    }

    function voucherDigest(PackVoucher calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(voucherStructHash(v));
    }

    function _checkSounds(uint256[] calldata ids) private pure {
        if (ids.length == 0 || ids.length > MAX_SOUNDS) revert BadSoundList();
        for (uint256 i = 1; i < ids.length; ++i) {
            if (ids[i] <= ids[i - 1]) revert BadSoundList(); // 升序且不重复
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
