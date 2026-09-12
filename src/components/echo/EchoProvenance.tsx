import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { EchoViewData } from '@/src/data/echo/types';

export default function EchoProvenance({ echo }: { echo: EchoViewData }) {
  const properties = echo.metadata.properties;
  const entries: ProvenanceEntry[] = [
    { id: 'origin', label: 'Origin wallet', value: echo.originWallet,
      source: 'PondEchoes.originWalletOf', href: `${echo.explorerUrl}#readContract` },
    { id: 'owner', label: 'Current owner', value: echo.owner,
      source: 'PondEchoes.ownerOf', href: `${echo.explorerUrl}#readContract` },
    { id: 'contract', label: 'P14 contract', value: echo.contractAddress,
      source: echo.network, href: echo.explorerUrl },
    { id: 'token', label: 'Token ID', value: echo.tokenId, displayValue: `#${echo.tokenId}`,
      source: 'Pond Echoes ERC-721', copyable: false },
    { id: 'uri', label: 'tokenURI', value: echo.tokenUri,
      source: 'PondEchoes.tokenURI', href: `${echo.verifiedGateways[0]}/${echo.metadataTxId}` },
    { id: 'metadata', label: 'Metadata txid', value: echo.metadataTxId,
      source: `${echo.verifiedGateways.length} 个网关字节一致`, href: `${echo.verifiedGateways[0]}/${echo.metadataTxId}` },
    { id: 'manifest', label: 'Clip manifest', value: properties.clipManifest,
      source: '永久 metadata', href: `${echo.verifiedGateways[0]}/${properties.clipManifest.slice(5)}` },
    { id: 'decoder', label: 'Permanent Decoder', value: echo.metadata.animation_url,
      source: '永久 metadata', href: echo.metadata.animation_url.replace('ar://', `${echo.verifiedGateways[0]}/`) },
  ];
  return <ProvenanceLedger title="永久凭证" entries={entries} />;
}
