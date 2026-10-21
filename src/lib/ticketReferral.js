import VotingCampaign from '@/app/models/VotingCampaign';
import Event from '@/app/models/Event';

export function parseCompetitionTicketReferral(referralId) {
  try {
    const payload = JSON.parse(String(referralId || ''));
    if (
      payload?.type !== 'competition' ||
      !/^[a-f\d]{24}$/i.test(String(payload.eventId || '')) ||
      !String(payload.fullName || '').trim() ||
      !String(payload.category || '').trim()
    ) {
      return null;
    }
    return {
      eventId: String(payload.eventId),
      fullName: String(payload.fullName).trim(),
      category: String(payload.category).trim(),
    };
  } catch {
    return null;
  }
}

function resolveCompetitionReferralToken(token) {
  const referral = parseCompetitionTicketReferral(token);
  if (!referral) return null;
  return {
    competitionEventId: referral.eventId,
    fullName: referral.fullName,
    category: referral.category,
  };
}

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

  const competitionReferral = resolveCompetitionReferralToken(token);
  if (competitionReferral) {
    const [ticketEvent, competitionEvent] = await Promise.all([
      Event.findById(eventId).select('organizerId status eventType').lean(),
      Event.findById(competitionReferral.competitionEventId)
        .select(
          'organizerId status eventType competition.ticketEventId competition.contestants'
        )
        .lean(),
    ]);
    if (
      !ticketEvent ||
      ticketEvent.status !== 'approved' ||
      ticketEvent.eventType === 'competition' ||
      !competitionEvent ||
      competitionEvent.status !== 'approved' ||
      competitionEvent.eventType !== 'competition' ||
      String(competitionEvent.competition?.ticketEventId || '') !==
        String(eventId) ||
      String(ticketEvent.organizerId || '') !==
        String(competitionEvent.organizerId || '')
    ) {
      return { valid: false, referral: null };
    }

    const contestant = (competitionEvent.competition?.contestants || []).find(
      (item) =>
        String(item.fullName || '')
          .trim()
          .toLowerCase() === competitionReferral.fullName.toLowerCase() &&
        String(item.category || '')
          .trim()
          .toLowerCase() === competitionReferral.category.toLowerCase()
    );
    if (contestant) {
      return {
        valid: true,
        referral: {
          referralCampaignId: null,
          referralCompetitionEventId: competitionEvent._id,
          referralContestantId: `${competitionEvent._id}:${competitionReferral.fullName.toLowerCase()}::${competitionReferral.category.toLowerCase()}`,
          referralContestantName: String(contestant.fullName || '').trim(),
          referralContestantCategory: String(contestant.category || '').trim(),
        },
      };
    }
  }

  return { valid: false, referral: null };
}
