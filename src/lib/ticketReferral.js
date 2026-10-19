import VotingCampaign from '@/app/models/VotingCampaign';

export async function resolveTicketReferral(eventId, referralId) {
  const token = String(referralId || '').trim();
  if (!token) return { valid: true, referral: null };

  const campaigns = await VotingCampaign.find({ eventId })
    .select('_id contestants nominees')
    .lean();

  for (const campaign of campaigns) {
    const contestants = campaign.contestants?.length
      ? campaign.contestants
      : campaign.nominees || [];
    const contestant = contestants.find((item) => String(item._id) === token);
    if (contestant) {
      return {
        valid: true,
        referral: {
          referralCampaignId: campaign._id,
          referralContestantId: String(contestant._id),
          referralContestantName: String(contestant.name || '').trim(),
        },
      };
    }
  }

  return { valid: false, referral: null };
}
