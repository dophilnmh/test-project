"use client";
import { motion } from "framer-motion";

import { StatCard } from "@/components/ui/StatCard";

import {
  Wallet,
  TrendingUp,
  CreditCard,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { members, loans } from "../data/mockData";

const currentMember = members[0];
const memberLoans = loans.filter((l) => l.memberId === currentMember.id);

// Annual contributions (KES 6,000 per year)
const recentContributions = [
  { year: "2024", amount: 6000, status: "paid", date: "2024-06-05" },
  { year: "2023", amount: 6000, status: "paid", date: "2023-06-03" },
  { year: "2022", amount: 6000, status: "paid", date: "2022-06-08" },
  { year: "2021", amount: 6000, status: "paid", date: "2021-06-02" },
  { year: "2020", amount: 6000, status: "paid", date: "2020-06-05" },
];

// Loan eligibility is 50% of total contributions
const loanEligibility = currentMember.totalContributions * 0.5;
const availableLoanAmount = loanEligibility - currentMember.outstandingLoan;

const MemberDashboard = () => {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            currentMember.status === "compliant"
              ? "bg-success/10 text-success"
              : currentMember.status === "pending"
              ? "bg-warning/10 text-warning"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {currentMember.status === "compliant" && (
            <CheckCircle className="h-4 w-4" />
          )}
          {currentMember.status === "pending" && <Clock className="h-4 w-4" />}
          {currentMember.status === "overdue" && (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium capitalize">
            {currentMember.status} Member
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Joined{" "}
          {new Date(currentMember.joinDate).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Contributions"
          value={`KES ${currentMember.totalContributions.toLocaleString()}`}
          icon={Wallet}
          description="Since joining"
          delay={0}
        />
        <StatCard
          title="Annual Dues"
          value="KES 6,000"
          icon={Calendar}
          description="Payable by first week of June"
          delay={0.1}
        />
        <StatCard
          title="Active Loans"
          value={memberLoans.filter((l) => l.status === "active").length}
          icon={CreditCard}
          description={`KES ${currentMember.outstandingLoan.toLocaleString()} outstanding`}
          delay={0.2}
        />
        <StatCard
          title="Loan Eligibility"
          value={`KES ${loanEligibility.toLocaleString()}`}
          icon={TrendingUp}
          description="50% of contributions"
          delay={0.3}
        />
      </div>

      {/* Available to Borrow Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Available to Borrow</p>
            <p className="text-2xl font-bold text-primary">
              KES {Math.max(0, availableLoanAmount).toLocaleString()}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Based on 50% of your contributions minus outstanding loans
          </p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card-premium p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-bold text-foreground">
              Recent Contributions
            </h2>
            <span className="text-xs text-muted-foreground">Last 5 years</span>
          </div>

          <div className="space-y-4">
            {recentContributions.map((contribution, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {contribution.year}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid on {contribution.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    KES {contribution.amount.toLocaleString()}
                  </p>
                  <span className="badge-compliant text-xs">Paid</span>
                </div>
              </div>
            ))}
          </div>

          {/* Contribution Info */}
          <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-medium">Annual dues:</span> KES
              6,000 payable by first week of June each year.
            </p>
          </div>
        </motion.div>

        {/* Loan Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="card-premium p-6"
        >
          <h2 className="text-xl font-serif font-bold text-foreground mb-6">
            Loan Status
          </h2>

          {memberLoans.length > 0 ? (
            <div className="space-y-6">
              {memberLoans.map((loan) => (
                <div key={loan.id} className="p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">
                      Loan #{loan.id}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        loan.status === "paid"
                          ? "bg-success/10 text-success"
                          : loan.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {loan.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Original Amount
                      </p>
                      <p className="font-semibold text-foreground">
                        KES {loan.amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-semibold text-foreground">
                        KES {loan.balance.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Monthly Payment
                      </p>
                      <p className="font-medium text-foreground">
                        KES {loan.monthlyPayment.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium text-foreground">
                        {loan.dueDate}
                      </p>
                    </div>
                  </div>

                  {loan.status !== "paid" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Repayment Progress
                        </span>
                        <span className="text-xs text-primary">
                          {Math.round((1 - loan.balance / loan.amount) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={(1 - loan.balance / loan.amount) * 100}
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No active loans</p>
              <p className="text-sm text-muted-foreground mt-1">
                Youre eligible to borrow up to KES{" "}
                {loanEligibility.toLocaleString()} (50% of contributions)
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default MemberDashboard;
