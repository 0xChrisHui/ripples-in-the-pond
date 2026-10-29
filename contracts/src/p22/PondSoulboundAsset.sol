// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {PermanentArUri} from "../PermanentArUri.sol";

/// P22 资产包素材基座：不可转让 ERC-1155，只有构造时固定的开包合约能铸，每次 1 份。
/// 铸造权不是角色，admin 无法授予；token 身份只追加、URI 一旦写入不可改。
abstract contract PondSoulboundAsset is ERC1155, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public immutable opener;
    string public name;
    string private _collectionUri;
    mapping(uint256 => string) private _tokenUri;

    event TokenDefined(uint256 indexed id, string uri);

    error InvalidRoles();
    error InvalidPermanentURI();
    error NotOpener();
    error UnknownToken(uint256 id);
    error AlreadyDefined(uint256 id);
    error Soulbound();
    error InvalidMint();

    constructor(
        string memory name_,
        string memory collectionUri_,
        address opener_,
        address admin_,
        address pauser_,
        uint48 adminDelay_
    ) ERC1155("") AccessControlDefaultAdminRules(adminDelay_, admin_) {
        if (opener_ == address(0) || admin_ == address(0) || pauser_ == address(0)) revert InvalidRoles();
        if (admin_ == pauser_ || admin_ == opener_ || pauser_ == opener_) revert InvalidRoles();
        if (!PermanentArUri.isValid(collectionUri_)) revert InvalidPermanentURI();
        name = name_;
        opener = opener_;
        _collectionUri = collectionUri_;
        _grantRole(PAUSER_ROLE, pauser_);
    }

    /// 追加新身份（不重排、不覆盖）。
    function defineTokens(uint256[] calldata ids, string[] calldata uris) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (ids.length != uris.length) revert InvalidMint();
        for (uint256 i = 0; i < ids.length; ++i) {
            if (bytes(_tokenUri[ids[i]]).length != 0) revert AlreadyDefined(ids[i]);
            if (!PermanentArUri.isValid(uris[i])) revert InvalidPermanentURI();
            _tokenUri[ids[i]] = uris[i];
            emit TokenDefined(ids[i], uris[i]);
        }
    }

    function isDefined(uint256 id) public view returns (bool) {
        return bytes(_tokenUri[id]).length != 0;
    }

    function uri(uint256 id) public view override returns (string memory) {
        if (!isDefined(id)) revert UnknownToken(id);
        return _tokenUri[id];
    }

    function contractURI() external view returns (string memory) {
        return _collectionUri;
    }

    function isSoulbound() external pure returns (bool) {
        return true;
    }

    function mint(address to, uint256 id) external nonReentrant whenNotPaused {
        if (msg.sender != opener) revert NotOpener();
        if (to == address(0) || !isDefined(id)) revert UnknownToken(id);
        _mint(to, id, 1, "");
    }

    function mintBatch(address to, uint256[] calldata ids) external nonReentrant whenNotPaused {
        if (msg.sender != opener) revert NotOpener();
        if (to == address(0) || ids.length == 0) revert InvalidMint();
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) {
            if (!isDefined(ids[i])) revert UnknownToken(ids[i]);
            amounts[i] = 1;
        }
        _mintBatch(to, ids, amounts, "");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override {
        if (from != address(0)) revert Soulbound(); // 含 burn / 零数量 / 自转
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 id)
        public
        view
        override(ERC1155, AccessControlDefaultAdminRules)
        returns (bool)
    {
        return id == 0xe8a3d485 || super.supportsInterface(id);
    }
}
