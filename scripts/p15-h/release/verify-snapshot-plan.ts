import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseScoreSnapshot, type ScoreSnapshotRow } from '../../../src/data/score/snapshot-contract';

type Snapshot = {
  tokenId: number; queueId: string | null; schemaId: string; originalTokenUri: string;
  metadata: unknown; events: unknown; sounds: unknown; resourceAttestations: unknown;
  compatibility: unknown; contentSha256: string;
};

async function main(): Promise<void> {
  const plan = JSON.parse(readFileSync(join(
    process.cwd(), 'reviews/evidence/p15-h/h7-snapshot-plan.json',
  ), 'utf8')) as { schema: string; generatedAt: string; snapshots: Snapshot[] };
  if (plan.schema !== 'p15-h7.snapshot-plan.v1' || plan.snapshots.length !== 4) {
    throw new Error('H7 snapshot plan 结构或数量错误');
  }
  for (const snapshot of plan.snapshots) {
    const row: ScoreSnapshotRow = {
      revision: 1, queue_id: snapshot.queueId, schema_id: snapshot.schemaId,
      original_token_uri: snapshot.originalTokenUri, metadata: snapshot.metadata,
      events: snapshot.events, sounds: snapshot.sounds,
      resource_attestations: snapshot.resourceAttestations,
      compatibility: snapshot.compatibility, content_sha256: snapshot.contentSha256,
      verified_at: plan.generatedAt,
    };
    const parsed = await parseScoreSnapshot(row);
    if (!parsed.manifest.permanentDecoderUrl.includes('?compat=')) {
      throw new Error(`Score #${snapshot.tokenId}: 未绑定永久兼容播放器`);
    }
    if (snapshot.tokenId === 2 && !parsed.playbackBootstrap.sounds.space) {
      throw new Error('Score #2: snapshot 仍缺少真实 space');
    }
  }
  console.log('H7 四枚历史 snapshot 运行时解析通过');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
