'use client';

import { useTranslations } from 'next-intl';
import ProvenanceLedger, { type ProvenanceEntry } from '@/src/components/p11/ProvenanceLedger';
import type { EchoViewData } from '@/src/data/echo/types';

export default function EchoProvenance({ echo }: { echo: EchoViewData }) {
  const t = useTranslations('echo');
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
      source: t('gatewaysMatch', { count: echo.verifiedGateways.length }), href: `${echo.verifiedGateways[0]}/${echo.metadataTxId}` },
    { id: 'manifest', label: 'Clip manifest', value: properties.clipManifest,
      source: t('permanentMetadata'), href: `${echo.verifiedGateways[0]}/${properties.clipManifest.slice(5)}` },
    { id: 'decoder', label: 'Permanent Decoder', value: echo.metadata.animation_url,
      source: t('permanentMetadata'), href: echo.metadata.animation_url.replace('ar://', `${echo.verifiedGateways[0]}/`) },
  ];
  return <ProvenanceLedger entries={entries} />;
}
