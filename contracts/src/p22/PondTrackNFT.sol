// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PondSoulboundAsset} from "./PondSoulboundAsset.sol";

/// 背景音乐素材（不可转让 ERC-1155）。
contract PondTrackNFT is PondSoulboundAsset {
    constructor(string memory collectionUri_, address opener_, address admin_, address pauser_, uint48 delay_)
        PondSoulboundAsset("Ripples Pond Track", collectionUri_, opener_, admin_, pauser_, delay_)
    {}
}
