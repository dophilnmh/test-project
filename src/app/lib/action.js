'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import connect from '../utils/db';
import User from '../models/User';
import cloudinary from '../config/cloudinary';

import Loan from '../models/Loan';

import axios from 'axios';
import Contribution from '../models/Contribution';
import LoanRepayment from '../models/LoanRepayment';
export const member = async (memberData) => {
  const { name, email, password, role } = memberData;

  try {
    await connect();

    // Check if member already exists by ID number or email in a single query
    const existingMember = await User.findOne({
      role: 'Superadmin',
      $or: [{ email }, { role }],
    });

    // 🔹 Then check business existence
    if (existingMember) {
      if (existingMember.email === email) {
        throw new Error('email iko');
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newMember = new User({
      name,
      email,

      role,
      password: hashedPassword,
    });

    await newMember.save();

    return {
      message: 'Superadmin account created successfully',
      user: {
        email: newMember.email,
        role: newMember.role,
        createdAt: newMember.createdAt,
      },
    };
  } catch (error) {
    console.error('Error in adding member:', error.message);
    throw new Error(error.message || 'Failed to create account');
  }
};
export const addMember = async (formData) => {
  await connect();

  let passportPhotoUrl = ''; // ✅ MOVE HERE

  try {
    const data =
      formData instanceof FormData ? Object.fromEntries(formData) : formData;

    const {
      firstName,
      lastName,
      email,
      phone,
      idNumber,
      dateOfBirth,
      gender,
      address,
      city,
      county,
      graduationYear,
      specialization,
      currentEmployer,
      occupation,
      membershipCategory,
      password,
      passportPhoto,
    } = data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const membershipNumber = `KAH-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    // --- checks ---
    const existingMemberByEmail = await User.findOne({
      email: email.toLowerCase(),
    });
    if (existingMemberByEmail) {
      return { success: false, message: 'Email already exists' };
    }

    const existingMemberById = await User.findOne({ idNumber });
    if (existingMemberById) {
      return { success: false, message: 'ID already exists' };
    }

    // --- upload passport ---
    if (passportPhoto && typeof passportPhoto !== 'string') {
      const bytes = await passportPhoto.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64String = buffer.toString('base64');
      const dataURI = `data:${passportPhoto.type};base64,${base64String}`;

      const uploadResult = await cloudinary.v2.uploader.upload(dataURI, {
        folder: 'members/passports',
        public_id: `passport_${idNumber}_${Date.now()}`,
      });

      passportPhotoUrl = uploadResult.secure_url;
    } else if (typeof passportPhoto === 'string') {
      passportPhotoUrl = passportPhoto;
    } else {
      throw new Error('Passport photo is required');
    }

    // --- save user ---
    const newMember = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase(),
      phone,
      idNumber,
      dateOfBirth,
      gender,
      address,
      name: `${firstName.trim()} ${lastName.trim()}`,
      city,
      county,
      graduationYear,
      specialization,
      currentEmployer,
      occupation,
      membershipNumber,
      membershipCategory,
      password: hashedPassword, // Make sure to hash this in production
      passportPhoto: passportPhotoUrl,
      role: 'member',
      status: 'Active',
    });

    await newMember.save();
    // Extract first name for SMS
    const Name = newMember.firstName.split(' ')[0].toUpperCase();
    // Prepare SMS message
    const smsMessage = `Dear ${Name}, welcome to the Kahalumni Association! Your membership number is ${newMember.membershipNumber}. Log in to start managing your account.`;
    const smsPayload = {
      apikey: process.env.API_KEY, // Use environment variable
      partnerID: process.env.PARTNER_ID, // Use environment variable
      message: smsMessage,
      shortcode: process.env.SENDERID, // Use environment variable
      mobile: phone,
    };

    // Send SMS
    try {
      const smsResponse = await axios.post(
        'https://sms.textsms.co.ke/api/services/sendsms/',
        smsPayload
      );

      const responseCode = smsResponse.data.responses[0]['response-code']; // Fix typo here
      if (responseCode === 200) {
      } else {
        console.error(
          'Failed to send SMS:',
          smsResponse.data.responses[0]['response-description']
        );
      }
    } catch (smsError) {
      console.error(
        'Error during SMS sending:',
        smsError.response ? smsError.response.data : smsError.message
      );
    }
    return { success: true, message: 'Member registered successfully' };
  } catch (error) {
    console.error('Error in addMember:', error);

    // ✅ SAFE cleanup
    if (passportPhotoUrl) {
      try {
        await cloudinary.v2.uploader.destroy(passportPhotoUrl);
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }

    return {
      success: false,
      message: error.message || 'Registration failed',
    };
  }
};

const generateLoanRef = () => `KAH-LN-${Date.now()}`;

export const addLoan = async (data) => {
  'use server';
  await connect();

  try {
    // 🔹 Extract TOP-LEVEL fields
    const {
      userId: memberId,
      principalAmount,
      interestRatePercent: interestRate,
      loanDurationMonths: loanDuration,

      purpose,
      approvedBy,
      status,
      disbursementDate,
      dueDate,
    } = data;
    const interestAmount = principalAmount * (interestRate / 100);
    const totalRepayment = principalAmount + interestAmount;
    const monthlyInstallment = totalRepayment / loanDuration;
    console.log({ interestAmount, totalRepayment, monthlyInstallment });
    // 🔹 Extract NESTED fields

    // --- HARD VALIDATION (before Mongo) ---
    if (!memberId) throw new Error('Member ID is required');
    if (principalAmount == null) throw new Error('principalAmount missing');
    if (interestRate == null) throw new Error('interestRatePercent missing');
    if (interestAmount == null) throw new Error('interestAmount missing');
    if (totalRepayment == null) throw new Error('totalRepayment missing');
    if (monthlyInstallment == null)
      throw new Error('monthlyInstallment missing');
    if (loanDuration == null) throw new Error('loanDurationMonths missing');

    if (!approvedBy) throw new Error('approvedBy missing');
    if (!disbursementDate || !dueDate) throw new Error('Loan dates missing');

    // 🔹 Ensure user exists
    const user = await User.findById(memberId);
    if (!user) throw new Error('Member not found');

    // 🔹 Prevent multiple active loans
    const activeLoan = await Loan.findOne({ user: memberId, status: 'active' });
    if (activeLoan) {
      throw new Error('Member already has an active loan');
    }

    const loanRef = generateLoanRef();

    // 🔹 CREATE LOAN (all values now defined)
    const loan = await Loan.create({
      user: memberId,
      loanRef,
      principalAmount,
      interestRatePercent: interestRate,
      interestAmount,
      totalRepayment,
      monthlyInstallment,
      loanDurationMonths: loanDuration,
      disbursementDate: new Date(disbursementDate),
      dueDate: new Date(dueDate),
      balance: totalRepayment,
      status: status || 'active',
      approvedBy,
      purpose,
    });

    // 🔹 Attach loan to user
    user.loans = user.loans || [];
    user.loans.push(loan._id);
    await user.save();
    // =====================
    // 📩 SEND SMS (DO NOT BREAK FLOW)
    // =====================
    try {
      const firstName = user.firstName.split(' ')[0].toUpperCase();

      const smsMessage = `Dear ${firstName}, your loan of KES ${amount.toLocaleString()} has been approved.
Loan Ref: ${loanRef}
Total Repayment: KES ${totalRepayment.toLocaleString()}
Due Date: ${new Date(dueDate).toDateString()}.`;

      const smsPayload = {
        apikey: process.env.API_KEY,
        partnerID: process.env.PARTNER_ID,
        shortcode: process.env.SENDERID,
        mobile: user.phone,
        message: smsMessage,
      };

      const smsResponse = await axios.post(
        'https://sms.textsms.co.ke/api/services/sendsms/',
        smsPayload
      );

      const responseCode = smsResponse.data?.responses?.[0]?.['response-code'];

      if (responseCode !== 200) {
        console.error(
          '⚠️ SMS failed:',
          smsResponse.data.responses[0]['response-description']
        );
      }
    } catch (smsError) {
      // ⚠️ NEVER fail loan creation because of SMS
      console.error(
        '⚠️ SMS error:',
        smsError.response?.data || smsError.message
      );
    }

    return {
      success: true,
      message: 'Loan created successfully',
      loanId: loan._id,
      loanRef,
    };
  } catch (error) {
    console.error('❌ addLoan error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create loan',
    };
  }
};

export const addpayment = async (memberData) => {
  await connect();

  const {
    memberId,
    amount,
    date,
    type,
    description,
    recordedBy,
    modeOfPayment,
    paymentreference,
  } = memberData;

  try {
    // 1️⃣ Find member
    const member = await User.findById(memberId);

    if (!member) {
      throw new Error('Member not found');
    }

    // 2️⃣ Save contribution
    const contribution = await Contribution.create({
      member: memberId,
      amount: Number(amount),
      type,
      description,
      modeOfPayment,
      paymentReference: paymentreference,
      recordedBy,
      date: date ? new Date(date) : new Date(),
    });

    // 3️⃣ Calculate new balance for SAME TYPE
    const balanceAgg = await Contribution.aggregate([
      { $match: { member: member._id, type } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const newBalance = balanceAgg[0]?.total || 0;

    // 4️⃣ SMS
    const smsMessage = `Dear ${member.firstName}, we have received your payment of KES ${amount} for ${type}.
Your total ${type} contributions are now KES ${newBalance}.
Thank you for supporting Kahalumni Association.`;

    const smsPayload = {
      apikey: process.env.API_KEY,
      partnerID: process.env.PARTNER_ID,
      message: smsMessage,
      shortcode: process.env.SENDERID,
      mobile: member.phone,
    };

    // Non-blocking SMS
    axios
      .post('https://sms.textsms.co.ke/api/services/sendsms/', smsPayload)
      .catch((e) => console.error('SMS error:', e.message));

    return {
      success: true,
      message: 'Payment recorded successfully',
      balance: newBalance,
      type,
    };
  } catch (error) {
    console.error('Error in addpayment:', error);

    // Duplicate payment reference
    if (error.code === 11000) {
      return {
        success: false,
        message: 'Payment reference already exists',
      };
    }

    return {
      success: false,
      message: error.message,
    };
  }
};

export const getRecentContributions = async (limit = 10) => {
  await connect();

  try {
    const contributions = await Contribution.find()
      .sort({ date: -1 })
      .limit(limit)
      .populate('member', 'firstName lastName membershipNumber phone name')
      .populate('recordedBy', 'firstName lastName')
      .lean();

    return {
      success: true,
      data: contributions.map((c) => ({
        id: c._id,

        // 🔹 contribution fields
        amount: c.amount,
        type: c.type,
        date: c.date,
        modeOfPayment: c.modeOfPayment,
        paymentReference: c.paymentReference,

        // 🔹 member fields (flattened)
        memberId: c.member?._id,
        firstName: c.member?.firstName,
        lastName: c.member?.lastName,
        memberName: c.member?.name,
        membershipNumber: c.member?.membershipNumber,
        phone: c.member?.phone,

        // 🔹 recorded by
        recordedBy: c.recordedBy
          ? `${c.recordedBy.firstName} ${c.recordedBy.lastName}`
          : 'System',
      })),
    };
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return {
      success: false,
      message: 'Failed to fetch contributions',
    };
  }
};

export const fetchUsers = async () => {
  'use server';
  try {
    await connect();

    const members = await User.find({ role: 'member' }); // Ensure this returns an array

    return members; // Return the array directly
  } catch (err) {
    throw new Error('Failed to fetch users!');
  }
};

export const fetchUserswithloan = async () => {
  'use server';

  try {
    await connect();

    // 1️⃣ Fetch members
    const users = await User.find({ role: 'member' })
      .select(
        'firstName lastName membershipNumber name phone email passportPhoto  status gender'
      )
      .lean();

    // 2️⃣ Enrich each user
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        // 🔹 Total loan-type contributions
        const loanContribAgg = await Contribution.aggregate([
          {
            $match: {
              member: user._id,
              type: 'loans',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
            },
          },
        ]);

        const loanContributionsTotal =
          loanContribAgg.length > 0 ? loanContribAgg[0].total : 0;

        // 🔹 ANNUAL contributions (individual records)
        const annualContributions = await Contribution.find({
          member: user._id,
          type: 'annual',
        })
          .sort({ date: -1 })
          .lean();

        const annualContributionTotal = annualContributions.reduce(
          (sum, c) => sum + c.amount,
          0
        );

        // 🔹 User loans
        const loans = await Loan.find({ user: user._id }).lean();

        // 🔹 Attach repayments to each loan
        const loansWithRepayments = await Promise.all(
          loans.map(async (loan) => {
            const repayments = await LoanRepayment.find({
              loan: loan._id,
            })
              .sort({ paymentDate: 1 })
              .lean();

            const totalRepaid = repayments.reduce(
              (sum, r) => sum + r.amountPaid,
              0
            );

            return {
              ...loan,
              totalRepaid,
              repayments,
            };
          })
        );

        return {
          ...user,
          loanContributionsTotal,
          annualContributionTotal,
          annualContributions, // 👈 individual records
          loans: loansWithRepayments,
        };
      })
    );

    console.log({ enrichedUsers });
    return enrichedUsers;
  } catch (err) {
    console.error(err);
    throw new Error('Failed to fetch users with loan data');
  }
};

export const recordLoanPaymentss = async (data) => {
  'use server';
  await connect();
  try {
    const { loanId, amountPaid, paymentDate, recordedBy } = data;
    const loan = await Loan.findById(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }
    const repayment = await LoanRepayment.create({
      loan: loanId,
      amountPaid,
      paymentDate: new Date(paymentDate),
      recordedBy,
    });
    loan.balance -= amountPaid;
    if (loan.balance <= 0) {
      loan.status = 'closed';
      loan.balance = 0;
    }
    await loan.save();
    return {
      success: true,
      message: 'Loan payment recorded successfully',
      repaymentId: repayment._id,
    };
  } catch (error) {
    console.error('❌ recordLoanPayment error:', error);
    return {
      success: false,
      message: error.message || 'Failed to record loan payment',
    };
  }
};

export const recordLoanPayment = async (data) => {
  'use server';
  await connect();

  try {
    const {
      loanId,
      amount,
      paymentMethod,
      paymentReference,
      paymentDate,
      recordedBy,
      memberId,
    } = data;

    // 1️⃣ Fetch loan
    const loan = await Loan.findById(loanId).populate('user');
    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== 'active') {
      throw new Error('Loan is not active');
    }

    // 2️⃣ Calculate new balance
    const newBalance = loan.balance - amount;
    const balanceAfterPayment = newBalance > 0 ? newBalance : 0;

    // 3️⃣ Save repayment record
    const repayment = await LoanRepayment.create({
      loan: loan._id,
      user: loan.user._id,
      amountPaid: amount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      modeOfPayment: paymentMethod,
      paymentReference,
      recordedBy,
      balanceAfterPayment,
    });

    // 4️⃣ Update loan
    loan.balance = balanceAfterPayment;

    let smsMessage = '';

    if (loan.balance === 0) {
      loan.status = 'completed';

      smsMessage = `🎉 Congratulations ${loan.user.firstName}!
Your loan (${loan.loanRef}) has been fully repaid.
Thank you for your commitment.`;
    } else {
      const today = new Date();
      const dueDate = new Date(loan.dueDate);

      let monthsRemaining = 0;
      if (dueDate > today) {
        monthsRemaining =
          (dueDate.getFullYear() - today.getFullYear()) * 12 +
          (dueDate.getMonth() - today.getMonth());
      }
      const formattedDueDate = new Date(loan.dueDate).toLocaleDateString(
        'en-GB',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );

      smsMessage = `Payment received for loan (${loan.loanRef}).
Amount: KES ${amount}
Remaining balance: KES ${loan.balance}
Remaining period: ${monthsRemaining} month(s)
Due on ${formattedDueDate}.`;
    }

    await loan.save();

    // 5️⃣ Send SMS (DO NOT change your SMS function)
    /*
    await sendSMS({
      to: loan.user.phone,
      message: smsMessage,
    });
    */
    const smsPayload = {
      apikey: process.env.API_KEY,
      partnerID: process.env.PARTNER_ID,
      message: smsMessage,
      shortcode: process.env.SENDERID,
      mobile: loan.user.phone,
    };

    // Non-blocking SMS
    axios
      .post('https://sms.textsms.co.ke/api/services/sendsms/', smsPayload)
      .catch((e) => console.error('SMS error:', e.message));

    return {
      success: true,
      message: 'Loan payment recorded successfully',
      repaymentId: repayment._id,
      loanStatus: loan.status,
      balance: loan.balance,
    };
  } catch (error) {
    console.error('❌ recordLoanPayment error:', error);
    return {
      success: false,
      message: error.message || 'Failed to record loan payment',
    };
  }
};
