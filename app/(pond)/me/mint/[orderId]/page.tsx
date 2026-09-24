import { notFound, redirect } from 'next/navigation';

const ORDER_ID = /^0x[0-9a-f]{64}$/;

export default async function LegacySelfMintOrderPage({ params }: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!ORDER_ID.test(orderId)) notFound();
  redirect(`/me?mintOrder=${orderId}`);
}
