// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PondSoulboundAsset} from "./PondSoulboundAsset.sol";

/// 音效素材（不可转让 ERC-1155）。
contract PondSoundNFT is PondSoulboundAsset {
    constructor(string memory collectionUri_, address opener_, address admin_, address pauser_, uint48 delay_)
        PondSoulboundAsset("Ripples Pond Sound", collectionUri_, opener_, admin_, pauser_, delay_)
    {}
}
