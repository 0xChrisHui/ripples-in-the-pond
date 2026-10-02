// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {PermanentArUri} from "../PermanentArUri.sol";

/// 35 项构造时固定的永久 metadata，未知编号明确拒绝。
abstract contract OriginalMetadata {
    mapping(uint256 => string) private _originalUris;
    string private _collectionUri;
    error InvalidOriginalMetadata();
    constructor(uint256[35] memory ids, string[35] memory uris, string memory collectionUri_) {
        if (!PermanentArUri.isValid(collectionUri_)) revert InvalidOriginalMetadata();
        _collectionUri = collectionUri_;
        for (uint256 i; i < 35; ++i) {
            if (ids[i] == 0 || bytes(_originalUris[ids[i]]).length != 0 || !PermanentArUri.isValid(uris[i])) {
                revert InvalidOriginalMetadata();
            }
            _originalUris[ids[i]] = uris[i];
        }
    }
    function originalUri(uint256 id) public view returns (string memory) {
        string memory value = _originalUris[id];
        if (bytes(value).length == 0) revert InvalidOriginalMetadata();
        return value;
    }
    function contractURI() external view returns (string memory) { return _collectionUri; }
}
