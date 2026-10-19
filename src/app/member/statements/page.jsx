"use client";
import { motion } from "framer-motion";

import { FileText, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const statements = [
  {
    id: "1",
    period: "January 2024",
    generatedDate: "2024-02-01",
    type: "Monthly Statement",
  },
  {
    id: "2",
    period: "December 2023",
    generatedDate: "2024-01-01",
    type: "Monthly Statement",
  },
  {
    id: "3",
    period: "November 2023",
    generatedDate: "2023-12-01",
    type: "Monthly Statement",
  },
  {
    id: "4",
    period: "Q4 2023",
    generatedDate: "2024-01-05",
    type: "Quarterly Summary",
  },
  {
    id: "5",
    period: "Year 2023",
    generatedDate: "2024-01-10",
    type: "Annual Report",
  },
];

const MemberStatements = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">
          My Statements
        </h1>
        <p className="text-muted-foreground">
          Download your contribution and loan statements
        </p>
      </div>

      <div className="space-y-4">
        {statements.map((statement) => (
          <motion.div
            key={statement.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {statement.period}
                </p>
                <p className="text-xs text-muted-foreground">
                  {statement.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {statement.generatedDate}
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default MemberStatements;
