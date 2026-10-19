import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import VotingCampaign from '@/app/models/VotingCampaign';
import { auth } from '@/app/auth';

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function mapTransaction(transaction, type, contestantName = '') {
  const normalizedContestant = String(
    contestantName || transaction.contestantName || ''
  ).trim();

  return {
    type,
    id: String(transaction._id || ''),
    status: transaction.status,
    recorded: transaction.status === 'paid',
    votes: Number(transaction.votes || 0),
    amount: Number(transaction.totalAmount || transaction.unitPrice || 0),
    mpesaReceiptNumber: String(transaction.mpesaReceiptNumber || '').trim(),
    checkoutRequestId: String(transaction.checkoutRequestId || '').trim(),
    paidAt: transaction.paidAt || null,
    packageName: String(transaction.packageName || '').trim(),
    campaignTitle: String(transaction.campaignTitle || '').trim(),
    eventTitle: String(transaction.eventTitle || '').trim(),
    voterPhone: String(transaction.voterPhone || '').trim(),
    voteRecordedFor: normalizedContestant || 'Unknown contestant',
  };
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = normalizeCode(searchParams.get('code'));

    if (!code) {
      return NextResponse.json({
        success: true,
        recorded: false,
        totalVotes: 0,
        matches: [],
        message: 'Enter an M-PESA transaction code to verify votes.',
      });
    }

    await connect();

    const [campaignVotes, competitionVotes] = await Promise.all([
      VotingTransaction.find({
        $or: [{ mpesaReceiptNumber: code }, { checkoutRequestId: code }],
      }).lean(),
      CompetitionVoteTransaction.find({
        $or: [{ mpesaReceiptNumber: code }, { checkoutRequestId: code }],
      }).lean(),
    ]);

    const campaignIds = Array.from(
      new Set(
        campaignVotes
          .map((item) => String(item?.campaignId || '').trim())
          .filter(Boolean)
      )
    );

    const campaigns =
      campaignIds.length > 0
        ? await VotingCampaign.find({ _id: { $in: campaignIds } })
            .select('contestants nominees')
            .lean()
        : [];

    const campaignMap = new Map(
      campaigns.map((campaign) => [String(campaign?._id || ''), campaign])
    );

    const resolveCampaignContestantName = (transaction) => {
      const campaign = campaignMap.get(String(transaction?.campaignId || ''));
      const pool =
        Array.isArray(campaign?.contestants) && campaign.contestants.length > 0
          ? campaign.contestants
          : Array.isArray(campaign?.nominees)
            ? campaign.nominees
            : [];

      const contestant = pool.find(
        (item) =>
          String(item?._id || '') === String(transaction?.contestantId || '')
      );

      return String(contestant?.name || '').trim();
    };

    const matches = [
      ...campaignVotes.map((item) =>
        mapTransaction(
          item,
          'campaign_vote',
          resolveCampaignContestantName(item)
        )
      ),
      ...competitionVotes.map((item) =>
        mapTransaction(item, 'competition_vote', item?.contestantName)
      ),
    ];

    const paidMatches = matches.filter((item) => item.recorded);
    const totalVotes = paidMatches.reduce((sum, item) => sum + item.votes, 0);

    return NextResponse.json({
      success: true,
      recorded: paidMatches.length > 0,
      totalVotes,
      matches,
      code,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to verify code' },
      { status: 500 }
    );
  }
}
