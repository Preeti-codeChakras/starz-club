
import SuccessClient from "./SuccessClient";

type SuccessPageProps = {
  searchParams: Promise<{
    club?: string;
    invite?: string;
    path?: string;
  }>;
};

export default async function CreateClubSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;

  return (
    <SuccessClient
      clubId={params.club ?? ""}
      inviteToken={params.invite ?? ""}
      invitePath={params.path ?? ""}
    />
  );
}
