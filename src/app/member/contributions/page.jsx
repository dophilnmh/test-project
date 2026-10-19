"use client";
import { motion } from "framer-motion";
import { Download, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { members } from "@/app/data/mockData";

const currentMember = members[0];

const contributionHistory = [
  {
    year: "2024",
    amount: 6000,
    status: "paid",
    date: "2024-06-05",
    method: "M-Pesa",
  },
  {
    year: "2023",
    amount: 6000,
    status: "paid",
    date: "2023-06-03",
    method: "M-Pesa",
  },
  {
    year: "2022",
    amount: 6000,
    status: "paid",
    date: "2022-06-08",
    method: "Bank Transfer",
  },
  {
    year: "2021",
    amount: 6000,
    status: "paid",
    date: "2021-06-02",
    method: "M-Pesa",
  },
  {
    year: "2020",
    amount: 6000,
    status: "paid",
    date: "2020-06-05",
    method: "M-Pesa",
  },
  {
    year: "2019",
    amount: 6000,
    status: "paid",
    date: "2019-06-04",
    method: "M-Pesa",
  },
];

const MemberContributions = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            My Contributions
          </h1>
          <p className="text-muted-foreground">
            Track your annual contribution history
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download Statement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card-premium p-4">
          <p className="text-sm text-muted-foreground">Total Contributions</p>
          <p className="text-2xl font-bold text-foreground">
            KES {currentMember.totalContributions.toLocaleString()}
          </p>
        </div>
        <div className="card-premium p-4">
          <p className="text-sm text-muted-foreground">Annual Dues</p>
          <p className="text-2xl font-bold text-primary">KES 6,000</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-sm text-muted-foreground">Years Contributed</p>
          <p className="text-2xl font-bold text-foreground">
            {Math.floor(currentMember.totalContributions / 6000)}
          </p>
        </div>
      </div>

      {/* Contribution Table */}
      <div className="card-premium overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30">
              <TableHead>Year</TableHead>
              <TableHead>Date Paid</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributionHistory.map((contribution, index) => (
              <TableRow key={index} className="border-border/30">
                <TableCell className="font-medium">
                  {contribution.year}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contribution.date}
                </TableCell>
                <TableCell>
                  KES {contribution.amount.toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contribution.method}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 badge-compliant">
                    <CheckCircle className="h-3 w-3" />
                    Paid
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default MemberContributions;
