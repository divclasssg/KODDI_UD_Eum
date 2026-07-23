import { ProfileScreenWithRouter } from "@/features/profile/profile-screen";
import { normalizeProfileReturnTo } from "@/features/profile/profile-navigation";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <ProfileScreenWithRouter
      returnTo={normalizeProfileReturnTo(returnTo)}
    />
  );
}
