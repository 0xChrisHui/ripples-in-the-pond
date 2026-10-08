import { notFound } from 'next/navigation';
import MaterialOrderView from '@/src/components/music-catalog/claim/MaterialOrderView';
import { materialOrderId } from '@/src/features/material-catalog/mint/order-model';
import '@/app/tracks/tracks.css';
export default async function MaterialOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  let id;
  try { id = materialOrderId(orderId); } catch { notFound(); }
  return <MaterialOrderView orderId={id} />;
}
