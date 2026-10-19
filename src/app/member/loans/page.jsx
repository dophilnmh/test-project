"use client";
import { motion } from "framer-motion";

import { CreditCard, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loans, members } from "@/app/data/mockData";

const currentMember = members[0];
const memberLoans = loans.filter((l) => l.memberId === currentMember.id);
// Loan eligibility is 50% of total contributions
const loanEligibility = currentMember.totalContributions * 0.5;
const availableLoanAmount = loanEligibility - currentMember.outstandingLoan;

const MemberLoans = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            My Loans
          </h1>
          <p className="text-muted-foreground">
            View your loan history and eligibility
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Apply for Loan
        </Button>
      </div>

      {/* Eligibility Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card-premium p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Maximum Loan Eligibility
              </p>
              <p className="text-2xl font-bold text-foreground">
                KES {loanEligibility.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Based on 50% of your total contributions of KES{" "}
            {currentMember.totalContributions.toLocaleString()}
          </p>
        </div>

        <div className="card-premium p-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                availableLoanAmount > 0 ? "bg-success/10" : "bg-warning/10"
              }`}
            >
              <CreditCard
                className={`h-6 w-6 ${
                  availableLoanAmount > 0 ? "text-success" : "text-warning"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Available to Borrow
              </p>
              <p
                className={`text-2xl font-bold ${
                  availableLoanAmount > 0 ? "text-success" : "text-warning"
                }`}
              >
                KES {Math.max(0, availableLoanAmount).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentMember.outstandingLoan > 0
              ? `Outstanding loan: KES ${currentMember.outstandingLoan.toLocaleString()}`
              : "No outstanding loans"}
          </p>
        </div>
      </div>

      {/* Loans List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Loan History</h2>

        {memberLoans.length > 0 ? (
          memberLoans.map((loan) => (
            <motion.div
              key={loan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-premium p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Loan #{loan.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Disbursed {loan.disbursementDate}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Principal</p>
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
                  <p className="font-medium text-foreground">{loan.dueDate}</p>
                </div>
              </div>

              {loan.status !== "paid" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      Repayment Progress
                    </span>
                    <span className="text-xs text-primary font-medium">
                      {Math.round((1 - loan.balance / loan.amount) * 100)}% paid
                    </span>
                  </div>
                  <Progress
                    value={(1 - loan.balance / loan.amount) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="card-premium p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-foreground font-medium">No loan history</p>
            <p className="text-sm text-muted-foreground mt-1">
              You havent taken any loans yet. Youre eligible to borrow up to KES{" "}
              {loanEligibility.toLocaleString()} (50% of your contributions).
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MemberLoans;
