import RoomClient from '@/components/RoomClient';

/**
 * `params` is a Promise in Next 16 — synchronous access was removed. This
 * server component awaits it and hands the plain code to the client tree,
 * which is where auth and realtime live.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
