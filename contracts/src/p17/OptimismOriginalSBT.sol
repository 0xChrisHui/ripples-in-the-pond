// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OriginalMetadata} from "./OriginalMetadata.sol";

/// 新OP原曲SBT，由项目minter付Gas；旧MaterialNFT及历史URI保持独立。
contract OptimismOriginalSBT is ERC1155, AccessControlDefaultAdminRules, Pausable,
    ReentrancyGuard, OriginalMetadata {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    error InvalidRoles();
    error InvalidMint();
    error Soulbound();

    constructor(uint256[35] memory ids, string[35] memory uris, string memory collectionUri_,
        address admin_, address minter_, address pauser_)
        ERC1155("") AccessControlDefaultAdminRules(2 days, admin_) OriginalMetadata(ids, uris, collectionUri_) {
        if (admin_ == address(0) || minter_ == address(0) || pauser_ == address(0)
            || admin_ == minter_ || admin_ == pauser_ || minter_ == pauser_) revert InvalidRoles();
        _grantRole(MINTER_ROLE, minter_); _grantRole(PAUSER_ROLE, pauser_);
    }
    function uri(uint256 id) public view override returns (string memory) { return originalUri(id); }
    function isSoulbound() external pure returns (bool) { return true; }
    function mint(address to, uint256 id, uint256 amount, bytes calldata data)
        external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        if (to == address(0) || amount != 1) revert InvalidMint();
        originalUri(id);
        _mint(to, id, 1, data);
    }
    function setApprovalForAll(address operator, bool approved) public override {
        if (approved) revert Soulbound();
        super.setApprovalForAll(operator, false);
    }
    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids,
        uint256[] memory amounts, bytes memory data) internal override {
        // 包括零数量/转给自己/操作员转让，任何非mint转移都不得通过。
        if (from != address(0)) revert Soulbound();
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    function supportsInterface(bytes4 id) public view override(ERC1155, AccessControlDefaultAdminRules)
        returns (bool) { return id == 0xe8a3d485 || super.supportsInterface(id); }
}
